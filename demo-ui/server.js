// UI server for the deliberation demo. It relays node RPC calls and seals finished runs.
// It has no authentication, so it binds to 127.0.0.1 unless ./demo start sets --ui-host.
const http = require('http');
const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');

const N = Number(process.env.DEMO_NODES || 3);
const HOST = process.env.DEMO_UI_HOST || '127.0.0.1';
const PORT = Number(process.env.DEMO_UI_PORT || 8700);
const ROOT = process.env.DEMO_ROOT || path.join(__dirname, '..');
const RUN = process.env.DEMO_RUN || path.join(ROOT, '.demo');
const PUBLIC = path.join(__dirname, 'public');
const SIDECAR = path.join(RUN, 'blocks.json');
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, 'problems.json')));
const STALL_MS = 120000;
const NODE_IDS = Array.from({length: N}, (_, i) => i + 1);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rpc(node, method, params = [], timeoutMs = 4000) {
    const res = await fetch(`http://127.0.0.1:${8600 + node}`, {
        method: 'POST',
        body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
}

const llmMode = () => { try { return fs.readFileSync(path.join(RUN, 'llm.mode'), 'utf8').trim(); } catch (e) { return null; } };
const readSidecar = () => { try { return JSON.parse(fs.readFileSync(SIDECAR)); } catch (e) { return {}; } };
function writeSidecar(hash, entry) {
    const all = readSidecar();
    all[hash] = entry;
    fs.writeFileSync(SIDECAR, JSON.stringify(all, null, 1));
}

/* ---------- answers ---------- */
function lastBoxed(text) {
    const at = text.lastIndexOf('\\boxed{');
    if (at < 0) return null;
    let depth = 0;
    for (let i = at + 6; i < text.length; i++) {
        if (text[i] === '{') depth++;
        if (text[i] === '}' && --depth === 0) return text.slice(at + 7, i);
    }
    return null;
}
function extractAnswer(text) {
    const boxed = lastBoxed(text);
    if (boxed !== null) return boxed.trim();
    const m = text.match(/final answer[^0-9$\\-]{0,30}(\$?-?[\d,]*\.?\d+(?:\/\d+)?%?)/i);
    return m ? m[1] : null;
}
function toNumber(raw) {
    if (raw === null) return null;
    let s = raw.replace(/\\text\{[^}]*\}/g, m => m.slice(6, -1)).replace(/\\[$%,]/g, m => m[1])
        .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2').replace(/[$,\s]/g, '');
    const m = s.match(/^(-?\d*\.?\d+)(?:\/(\d*\.?\d+))?/);
    if (!m) return null;
    return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
}
function answersFor(messages, known) {
    const last = new Map();
    for (const m of messages) last.set(m.node, m.text);
    const rows = [...last.entries()].sort((a, b) => a[0] - b[0]).map(([node, text]) => {
        const raw = extractAnswer(text);
        const value = toNumber(raw);
        const correct = known && value !== null ? Math.abs(value - known.value) <= known.tolerance : null;
        return {node, raw, value, unclear: value === null, correct};
    });
    const clear = rows.filter(r => !r.unclear);
    const agree = rows.length > 0 && clear.length === rows.length
        && clear.every(r => Math.abs(r.value - clear[0].value) < 1e-6);
    return {rows, agree, unclearCount: rows.length - clear.length};
}

/* ---------- order of replies; this mirrors Deliberation.increaseSpeakerIndex ---------- */
function passes(rounds, turns) {
    const out = [];
    let r = 1, t = 1;
    while (r <= rounds && out.length < 100) {
        out.push({round: r, turn: t});
        if (r === 2) { t++; if (t > turns) r++; } else r++;
    }
    return out;
}

/* ---------- live state ---------- */
const addresses = {};
let nodes = NODE_IDS.map(i => ({index: i, up: false}));
let run = {phase: 'idle'};
let stableTicks = 0;
let lastCounts = '';

async function pollNode(i) {
    try {
        if (!addresses[i]) addresses[i] = await rpc(i, 'nodeAddress');
        const [consensus, peers, height, messageCount, state] = await Promise.all([
            rpc(i, 'consensus'), rpc(i, 'peerCount'), rpc(i, 'blockNumber'), rpc(i, 'messageCount'), rpc(i, 'deliberationState'),
        ]);
        return {index: i, up: true, address: addresses[i], consensus, peers, height, messageCount, state};
    } catch (e) {
        delete addresses[i];
        return {index: i, up: false};
    }
}
const nodeOf = hex => { const f = NODE_IDS.find(i => addresses[i] === hex); return f || null; };
const mostAdvanced = () => nodes.filter(n => n.up && n.state)
    .sort((a, b) => b.state.replies.length - a.state.replies.length)[0];

function transcript() {
    const lead = mostAdvanced();
    if (run.phase === 'starting' || !lead || !run.problem || lead.state.problem !== run.problem) return [];
    return lead.state.replies.map(r => ({
        key: `${r.round},${r.turn},${r.speakerIndex}`, round: r.round, turn: r.turn,
        node: nodeOf(lead.state.participants[r.speakerIndex]), text: r.text,
    }));
}
function setError(message) {
    console.error(message);
    run.phase = 'error';
    run.error = message;
}
async function tick() {
    nodes = await Promise.all(NODE_IDS.map(pollNode));
    if (run.phase !== 'running') return;
    const live = transcript();
    for (const m of live) if (!(m.key in run.seen)) run.seen[m.key] = Date.now();
    if (live.length !== run.replyCount) { run.replyCount = live.length; run.lastReplyAt = Date.now(); }
    const down = nodes.find(n => !n.up);
    if (down) return setError(`Node ${down.index} stopped responding.`);
    const ended = nodes.every(n => n.state.isEnd && n.state.problem === run.problem);
    const counts = nodes.map(n => n.messageCount).join();
    const same = new Set(nodes.map(n => n.messageCount)).size === 1 && nodes[0].messageCount > 0;
    stableTicks = ended && same && counts === lastCounts ? stableTicks + 1 : 0;
    lastCounts = counts;
    if (stableTicks >= 2) await seal();
}
async function seal() {
    run.phase = 'sealing';
    run.finishedAt = Date.now();
    const finalMessages = transcript();
    try {
        const before = await rpc(1, 'blockNumber');
        await rpc(1, 'mint', [], 30000);
        const end = Date.now() + 30000;
        let heights = [];
        while (Date.now() < end) {
            heights = await Promise.all(NODE_IDS.map(i => rpc(i, 'blockNumber')));
            if (heights.every(h => h > before)) break;
            await sleep(400);
        }
        if (!heights.every(h => h > before)) throw new Error(`Block did not reach every node. Heights: ${heights.join(', ')}.`);
        const number = before + 1;
        const blocks = await Promise.all(NODE_IDS.map(i => rpc(i, 'getBlockByNumber', [number, false])));
        const entry = {
            problem: run.problem, rounds: run.rounds, turns: run.turns, known: run.known,
            startedAt: run.startedAt, finishedAt: run.finishedAt,
            // For replays: which LLM wrote the replies, and when each reply arrived (ms after the start).
            llm: llmMode(),
            replyTimes: finalMessages.map(m => run.seen[m.key] - run.startedAt).sort((a, b) => a - b),
        };
        writeSidecar(blocks[0].hash, entry);
        run.transcript = finalMessages;
        run.block = await describeBlock(number);
        run.phase = 'sealed';
    } catch (e) {
        setError(`Sealing failed: ${e.message}`);
    }
}
async function loop() {
    for (;;) {
        try { await tick(); } catch (e) { console.error('tick', e); }
        await sleep(1000);
    }
}

/* ---------- block decoding ---------- */
function decodeMessages(extraData, entry) {
    if (!extraData) return [];
    const lines = Buffer.from(extraData, 'hex').toString('latin1').split('\n');
    const out = [];
    for (const line of lines) {
        const m = line.match(/^([0-9a-f]{64}) : (.*)$/s);
        if (m) out.push({address: m[1], node: nodeOf(m[1]), text: m[2]});
    }
    const order = entry ? passes(entry.rounds, entry.turns) : [];
    const width = order.length ? Math.ceil(out.length / order.length) : 0;
    out.forEach((m, i) => {
        const p = width ? order[Math.floor(i / width)] : null;
        m.key = String(i);
        m.round = p ? p.round : null;
        m.turn = p ? p.turn : null;
    });
    return out;
}
async function describeBlock(number) {
    const results = await Promise.all(NODE_IDS.map(async i => {
        try { return {node: i, block: await rpc(i, 'getBlockByNumber', [number, false])}; }
        catch (e) { return {node: i, block: null}; }
    }));
    const first = results.find(r => r.block);
    if (!first) return null;
    const b = first.block;
    const entry = readSidecar()[b.hash] || null;
    const messages = decodeMessages(b.extraData, entry);
    const hashes = results.map(r => ({node: r.node, hash: r.block ? r.block.hash : null}));
    return {
        number: b.number, hash: b.hash, parentHash: b.parentHash, timestamp: b.timestamp, size: b.size,
        problem: entry ? entry.problem : null, rounds: entry ? entry.rounds : null, turns: entry ? entry.turns : null,
        known: entry ? entry.known : null, startedAt: entry ? entry.startedAt : null, finishedAt: entry ? entry.finishedAt : null,
        llm: entry ? entry.llm || null : null, replyTimes: entry ? entry.replyTimes || null : null,
        hashes, allMatch: hashes.every(h => h.hash === b.hash),
        messages, answers: answersFor(messages, entry && entry.known),
        extraDataBytes: b.extraData ? b.extraData.length / 2 : 0,
    };
}
async function listBlocks() {
    const head = await rpc(1, 'blockNumber');
    const out = [];
    for (let n = head; n >= 2; n--) {
        const b = await rpc(1, 'getBlockByNumber', [n, false]);
        const entry = readSidecar()[b.hash] || null;
        out.push({
            number: b.number, hash: b.hash, timestamp: b.timestamp, size: b.size,
            messageCount: decodeMessages(b.extraData, null).length,
            problem: entry ? entry.problem : null, llm: entry ? entry.llm || null : null,
        });
    }
    return out;
}

/* ---------- commands ---------- */
async function beginRun(problem, rounds, turns) {
    const known = POOL.find(p => p.problem === problem) || null;
    run = {
        phase: 'starting', problem, rounds, turns, startedAt: Date.now(), lastReplyAt: Date.now(), replyCount: 0, seen: {},
        known: known ? {answer: known.answer, value: known.value, tolerance: known.tolerance} : null,
    };
    stableTicks = 0;
    lastCounts = '';
    try {
        await rpc(1, 'initDeliberation', [addresses[1], {problem, rounds: String(rounds), turns: String(turns)}], 30000);
        const end = Date.now() + 40000;
        let ready = false;
        while (Date.now() < end && !ready) {
            await sleep(300);
            const states = await Promise.all(NODE_IDS.map(i => rpc(i, 'deliberationState')));
            ready = states.every(s => s.problem === problem && !s.isEnd && s.participants.length === N);
        }
        if (!ready) throw new Error(`Not all ${N} nodes received the problem in 40 s.`);
        // Each node finishes its /init call after it stores the problem.
        await sleep(2000);
        run.startedAt = run.lastReplyAt = Date.now();
        run.phase = 'running';
        // startDeliberation returns only after the first LLM reply, so it runs in the background.
        rpc(1, 'startDeliberation', [], 900000).catch(e => {
            if (run.phase === 'running') setError(`Start failed: ${e.message}`);
        });
    } catch (e) {
        setError(`Start failed: ${e.message}`);
    }
}
function restartNodes() {
    run = {phase: 'restarting'};
    const child = spawn(path.join(ROOT, 'demo'), ['restart-nodes'], {cwd: ROOT, stdio: 'ignore'});
    child.on('exit', code => {
        for (const k of Object.keys(addresses)) delete addresses[k];
        run = code === 0 ? {phase: 'idle'} : {phase: 'error', error: `Node restart failed with code ${code}. See ${RUN}.`};
    });
}
function statePayload() {
    const live = run.phase === 'sealed' ? run.transcript : transcript();
    const lead = mostAdvanced();
    let speakingNode = null, currentRound = null, currentTurn = null;
    if (run.phase === 'running' && lead && lead.state.problem === run.problem && !lead.state.isEnd) {
        speakingNode = nodeOf(lead.state.currentSpeaker);
        currentRound = lead.state.currentRound;
        currentTurn = lead.state.currentTurn;
    }
    const held = n => (run.phase !== 'starting' && n.state && n.state.problem === run.problem ? n.state.replies.length : 0);
    return {
        now: Date.now(), phase: run.phase, error: run.error || null, problem: run.problem || null,
        rounds: run.rounds || null, turns: run.turns || null,
        expected: run.rounds ? passes(run.rounds, run.turns).length * N : null,
        startedAt: run.startedAt || null, finishedAt: run.finishedAt || null, lastReplyAt: run.lastReplyAt || null,
        stalled: run.phase === 'running' && Date.now() - run.lastReplyAt > STALL_MS,
        speakingNode, currentRound, currentTurn, transcript: live, block: run.block || null,
        nodes: nodes.map(n => ({
            index: n.index, up: n.up, address: n.address || null, consensus: n.consensus || null,
            peers: n.up ? n.peers : null, height: n.up ? n.height : null, messageCount: n.up ? n.messageCount : null, held: held(n),
        })),
    };
}

/* ---------- HTTP ---------- */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2'};
function json(res, code, body) {
    res.writeHead(code, {'content-type': 'application/json', 'cache-control': 'no-store'});
    res.end(JSON.stringify(body));
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let s = '';
        req.on('data', d => { s += d; if (s.length > 100000) req.destroy(); });
        req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    });
}
function startProblem(body) {
    const problem = String(body.problem || '').trim();
    const rounds = Number(body.rounds), turns = Number(body.turns);
    if (!['idle', 'sealed', 'error'].includes(run.phase)) return 'A deliberation is already running.';
    if (!problem) return 'The problem text is empty.';
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) return 'Rounds must be a whole number from 1 to 5.';
    if (!Number.isInteger(turns) || turns < 1 || turns > 5) return 'Turns must be a whole number from 1 to 5.';
    if (!nodes.every(n => n.up && n.consensus === 'established')) return 'Not all nodes have consensus yet.';
    if (nodes[0].peers !== N - 1) return `Node 1 has ${nodes[0].peers} peers and needs ${N - 1}.`;
    beginRun(problem, rounds, turns);
    return null;
}
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
        if (url.pathname === '/api/state') return json(res, 200, statePayload());
        if (url.pathname === '/api/problems') return json(res, 200, POOL.map(({id, title, problem}) => ({id, title, problem})));
        if (url.pathname === '/api/blocks') return json(res, 200, await listBlocks());
        const m = url.pathname.match(/^\/api\/blocks\/(\d+)$/);
        if (m) {
            const block = await describeBlock(Number(m[1]));
            return json(res, block ? 200 : 404, block || {error: 'No such block.'});
        }
        if (req.method === 'POST' && url.pathname === '/api/start') {
            const err = startProblem(await readBody(req));
            return err ? json(res, 409, {error: err}) : json(res, 200, {ok: true});
        }
        if (req.method === 'POST' && url.pathname === '/api/new') {
            if (['sealed', 'error'].includes(run.phase)) run = {phase: 'idle'};
            return json(res, 200, {ok: true});
        }
        if (req.method === 'POST' && url.pathname === '/api/restart-nodes') {
            if (run.phase !== 'restarting') restartNodes();
            return json(res, 200, {ok: true});
        }
        if (url.pathname.startsWith('/api/')) return json(res, 404, {error: 'Not found.'});

        const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
        if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404);
            return res.end('Not found');
        }
        res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
        fs.createReadStream(file).pipe(res);
    } catch (e) {
        json(res, 500, {error: e.message});
    }
}).listen(PORT, HOST, () => console.log(`UI on http://${HOST}:${PORT}`));
loop();
