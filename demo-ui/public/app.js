const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const color = n => `var(--n${((n || 1) - 1) % 4 + 1})`;
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };
async function api(path, body) {
    const opts = body === undefined ? {} : {method: 'POST', body: JSON.stringify(body)};
    const res = await fetch(`api/${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
}

/* ---------- reply rendering: Markdown headers, bold, and LaTeX ---------- */
function math(src, display) {
    try { return katex.renderToString(src, {displayMode: display, throwOnError: false}); }
    catch (e) { return esc(src); }
}
// Math goes into slots first, so that later text rules cannot change it.
function holdMath(raw, slots) {
    const hold = html => { slots.push(html); return `\u0001${slots.length - 1}\u0002`; };
    let s = raw.replace(/\\\$/g, '\u0003');
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => hold(math(m, true)));
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => hold(math(m, true)));
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => hold(math(m, false)));
    // A dollar sign opens math only before non-space text and closes only after it, so "$7 and $10" stays text.
    return s.replace(/\$(?=\S)([^$\n]*?\S)\$(?!\d)/g, (_, m) => hold(math(m.replace(/\u0003/g, '\\$'), false)));
}
function textHtml(s, slots) {
    return esc(s).replace(/\u0003/g, '$').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\u0001(\d+)\u0002/g, (_, i) => slots[Number(i)]);
}
function inlineMath(raw) {
    const slots = [];
    return textHtml(holdMath(raw, slots), slots);
}
function renderReply(text) {
    const slots = [];
    // The node replaces each newline with a space, so a blank line arrives as two spaces.
    const lines = holdMath(text, slots)
        .replace(/ {2,}/g, '\n')
        .replace(/\s*(#{1,6}\s)/g, '\n$1')
        .replace(/([^#*\s]\s+)(\*\*Step \d|Step \d+:)/g, '$1\n$2')
        .split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map(line => {
        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (!h) return `<p>${textHtml(line, slots)}</p>`;
        if (h[1].length <= 70) return `<h4>${textHtml(h[1], slots)}</h4>`;
        // This header lost its line end. Llama headers are lowercase after the first word,
        // so the header ends before the first capitalized word ("...the shorts Anns bought").
        const t = h[1].match(/^((?:Step \d+:\s*)?\S+(?:\s+(?![A-Z])\S+){0,11})\s+([A-Z]\S*(?:\s+\S+){2,}.*)$/);
        if (t) return `<h4>${textHtml(t[1], slots)}</h4><p>${textHtml(t[2], slots)}</p>`;
        // Otherwise the header ends at the first sentence break.
        const at = h[1].slice(10).search(/[.:]\s/);
        if (at < 0) return `<h4>${textHtml(h[1], slots)}</h4>`;
        return `<h4>${textHtml(h[1].slice(0, at + 11), slots)}</h4><p>${textHtml(h[1].slice(at + 12), slots)}</p>`;
    }).join('');
}

/* ---------- shared pieces ---------- */
function fingerprint(hash) {
    let cells = '';
    for (let i = 0; i + 3 < 64 && hash; i += 4) {
        const v = parseInt(hash.slice(i, i + 4), 16);
        cells += `<i style="background:hsl(${v % 360} ${45 + v % 35}% ${30 + (v >> 8) % 35}%)"></i>`;
    }
    return `<div class="finger" aria-hidden="true">${cells}</div>`;
}
function hashRows(block) {
    return block.hashes.map(h => `<div class="hashrow" style="--c:${color(h.node)}">
        <div class="who">Node ${h.node}</div>${fingerprint(h.hash)}
        <div class="hash">${h.hash ? esc(h.hash) : 'no block'}</div></div>`).join('');
}
function answersHtml(block) {
    const a = block.answers;
    const known = block.known;
    const cards = a.rows.map(r => {
        const verdict = r.unclear ? '<span class="tag">No clear final answer</span>'
            : known ? (r.correct ? '<span class="tag yes">Matches the correct answer</span>' : '<span class="tag no">Differs from the correct answer</span>') : '';
        // A plain "$5" is money, so the dollar sign is escaped before KaTeX reads it.
        const value = r.unclear ? 'Unclear' : math(r.raw.replace(/(^|[^\\])\$/g, '$1\\$'), false);
        const equal = !r.unclear && String(r.value) !== r.raw ? `<div class="tag">= ${esc(+r.value.toFixed(4))}</div>` : '';
        return `<div class="answer ${r.unclear ? 'unclear' : ''}" style="--c:${color(r.node)}">
            <div class="who">Node ${r.node}</div><div class="val">${value}</div>${equal}${verdict}</div>`;
    }).join('');
    const summary = a.agree ? 'All nodes state the same final answer.'
        : a.unclearCount ? `${a.unclearCount} of ${a.rows.length} nodes gave no clear final answer.` : 'The nodes state different final answers.';
    return `<h2>Final answers</h2><div class="answers">${cards}</div><p class="note">${summary}</p>
        ${known ? `<div class="correct">Correct answer: <strong>${esc(known.answer)}</strong></div>` : ''}`;
}
function transcriptHtml(messages) {
    let html = '', section = '';
    for (const m of messages) {
        const label = m.round === null || m.round === undefined ? 'Messages'
            : m.round === 2 ? `Round 2, turn ${m.turn}` : `Round ${m.round}`;
        if (label !== section) { html += `<div class="round-title">${label}</div>`; section = label; }
        html += `<article class="msg" style="--c:${color(m.node)}"><div class="who">Node ${m.node || '?'}</div>${renderReply(m.text)}</article>`;
    }
    return html;
}

/* ---------- deliberation view ---------- */
let problems = [];
let selectedId = null;
const rendered = {sealKey: null, transcriptKey: null};

function drawPool() {
    $('pool').innerHTML = problems.map(p => `<button type="button" data-id="${esc(p.id)}" aria-pressed="${p.id === selectedId}">
        <span class="title">${esc(p.title)}</span><span class="snippet">${esc(p.problem)}</span></button>`).join('');
}
$('pool').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    selectedId = b.dataset.id;
    $('problem').value = problems.find(p => p.id === selectedId).problem;
    $('rounds').value = 2;
    $('turns').value = 1;
    $('start-note').textContent = '';
    drawPool();
});
$('problem').addEventListener('input', () => {
    const p = problems.find(x => x.id === selectedId);
    if (p && p.problem !== $('problem').value) { selectedId = null; drawPool(); }
});
$('editor').addEventListener('submit', async e => {
    e.preventDefault();
    $('start').disabled = true;
    try {
        await api('start', {problem: $('problem').value, rounds: Number($('rounds').value), turns: Number($('turns').value)});
        $('start-note').textContent = '';
    } catch (err) {
        $('start-note').textContent = err.message;
    }
    poll();
});

function drawNetwork(s) {
    const up = s.nodes.filter(n => n.up);
    const ok = up.length === s.nodes.length && up.every(n => n.consensus === 'established');
    const height = up.length ? Math.max(...up.map(n => n.height)) : '-';
    $('network').innerHTML = `<span class="${ok ? 'good' : 'notgood'}">${up.length} of ${s.nodes.length} nodes ${ok ? 'in consensus' : 'ready'}</span> · chain height ${height}`;
    return ok;
}
function drawBanner(s) {
    const b = $('banner');
    let text = '', bad = false;
    if (s.phase === 'error') { text = s.error; bad = true; }
    else if (s.phase === 'restarting') text = 'Restarting the nodes. The chain stays.';
    else if (s.stalled) text = `No reply for ${fmt(s.now - s.lastReplyAt)}. The LLM server can be stuck.`;
    if (!text) { b.hidden = true; return; }
    b.hidden = false;
    b.className = `banner${bad ? ' bad' : ''}`;
    const action = s.phase === 'restarting' ? '' : '<button class="secondary" id="restart">Restart nodes and keep the chain</button>';
    if (b.dataset.text !== text + s.phase) {
        b.dataset.text = text + s.phase;
        b.innerHTML = `<span id="banner-text"></span>${action}`;
    }
    $('banner-text').textContent = text;
}
$('banner').addEventListener('click', e => {
    if (e.target.id === 'restart') api('restart-nodes', {}).then(poll);
});
function drawCards(s) {
    const total = s.expected || 0;
    $('cards').innerHTML = s.nodes.map(n => {
        const speaking = s.speakingNode === n.index;
        let status;
        if (!n.up) status = 'Offline';
        else if (speaking) status = `<span class="dots"><span></span><span></span><span></span></span>Thinking ${fmt(s.now - s.lastReplyAt)}`;
        else if (s.phase === 'starting') status = 'Receiving the problem';
        else if (s.phase === 'sealing') status = 'Sealing';
        else if (s.phase === 'sealed') status = 'Holds the block';
        else if (s.phase === 'running') status = 'Waiting for its turn';
        else status = 'Idle';
        return `<div class="card ${speaking ? 'speaking' : ''}" style="--c:${color(n.index)}">
            <div class="name">Node ${n.index}</div><div class="key">${n.address ? esc(n.address.slice(0, 16)) + '…' : ''}</div>
            <div class="status">${status}</div>
            <div class="held">${s.phase === 'sealed' ? `Chain height ${n.height}` : `Holds ${n.held} of ${total} replies`}</div></div>`;
    }).join('');
}
function drawProgress(s) {
    const count = s.transcript.length;
    const total = s.expected || 0;
    let text;
    if (s.phase === 'starting') text = 'Sending the problem to every node';
    else if (s.phase === 'sealing') text = 'All replies are on every node. Sealing the block.';
    else if (s.phase === 'sealed') text = `${count} replies in ${fmt(s.finishedAt - s.startedAt)}`;
    else if (s.currentRound) text = `Round ${s.currentRound}${s.currentRound === 2 ? `, turn ${s.currentTurn}` : ''} · ${count} of ${total} replies · ${fmt(s.now - s.startedAt)}`;
    else text = `${count} of ${total} replies`;
    $('progress').textContent = text;
    $('bar-fill').style.width = `${total ? Math.min(100, 100 * count / total) : 0}%`;
}
function drawSeal(s) {
    const box = $('seal');
    if (s.phase !== 'sealed' || !s.block) {
        box.hidden = true;
        rendered.sealKey = null;
        return;
    }
    if (rendered.sealKey === s.block.hash) return;
    rendered.sealKey = s.block.hash;
    const b = s.block;
    box.hidden = false;
    box.className = `seal ${b.allMatch ? 'match' : 'mismatch'}`;
    box.innerHTML = `<p class="verdict">${b.allMatch ? `All ${b.hashes.length} nodes hold the same block` : 'The nodes hold different blocks'}</p>
        <div class="seal-sub">Block ${b.number} · ${b.messages.length} messages · ${b.size} bytes</div>
        ${hashRows(b)}${answersHtml(b)}
        <div class="seal-foot"><span class="note">Every reply in the transcript is now stored in this block.</span>
        <button class="primary" id="new-run">New deliberation</button></div>`;
    window.scrollTo({top: 0, behavior: 'smooth'});
}
$('seal').addEventListener('click', e => {
    if (e.target.id === 'new-run') api('new', {}).then(() => { $('problem').focus(); poll(); });
});
function drawTranscript(s) {
    const key = s.transcript.map(m => m.key).join('|');
    if (key === rendered.transcriptKey) return;
    rendered.transcriptKey = key;
    $('transcript').innerHTML = transcriptHtml(s.transcript);
    $('transcript-title').hidden = !s.transcript.length;
    if (s.phase === 'running') $('transcript').lastElementChild?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
function drawRun(s) {
    const picking = s.phase === 'idle' || s.phase === 'restarting' || (s.phase === 'error' && !s.problem);
    $('stage-pick').hidden = !picking;
    $('stage-live').hidden = picking;
    if (picking) {
        const ready = drawNetwork(s) && s.phase === 'idle';
        $('start').disabled = !ready;
        if (!ready && !$('start-note').textContent) $('start-note').textContent = 'Waiting for the nodes.';
        if (ready && $('start-note').textContent === 'Waiting for the nodes.') $('start-note').textContent = '';
        rendered.transcriptKey = null;
        return;
    }
    $('live-problem').innerHTML = inlineMath(s.problem || '');
    drawProgress(s);
    drawSeal(s);
    $('cards').classList.toggle('sticky', s.phase === 'running' || s.phase === 'starting');
    drawCards(s);
    drawTranscript(s);
}

/* ---------- block history ---------- */
let selectedBlock = null;
let chainKey = null;
async function loadChain() {
    let blocks;
    try { blocks = await api('blocks'); } catch (e) { return; }
    const key = blocks.map(b => b.hash).join();
    $('chain-empty').hidden = blocks.length > 0;
    if (key === chainKey) return;
    chainKey = key;
    if (!blocks.some(b => b.number === selectedBlock)) { selectedBlock = null; $('block-detail').innerHTML = ''; }
    drawChain(blocks);
}
function drawChain(blocks) {
    $('chain').innerHTML = blocks.map((b, i) => `${i ? '<div class="link"></div>' : ''}
        <button class="tile" data-n="${b.number}" aria-pressed="${b.number === selectedBlock}">
        <span class="num">Block ${b.number}</span><span class="h">${esc(b.hash.slice(0, 16))}…</span>
        <span class="t">${esc(b.problem || `${b.messageCount} messages`)}</span>
        <span class="h">${new Date(b.timestamp * 1000).toLocaleString()}</span></button>`).join('');
}
$('chain').addEventListener('click', async e => {
    const t = e.target.closest('.tile');
    if (!t) return;
    selectedBlock = Number(t.dataset.n);
    document.querySelectorAll('.tile').forEach(x => x.setAttribute('aria-pressed', x === t));
    const b = await api(`blocks/${selectedBlock}`);
    $('block-detail').innerHTML = `<div class="seal ${b.allMatch ? 'match' : 'mismatch'}">
        <p class="verdict">${b.allMatch ? `Block ${b.number}: all ${b.hashes.length} nodes match` : `Block ${b.number}: nodes differ`}</p>
        <div class="seal-sub">${b.messages.length} messages · ${b.size} bytes · ${new Date(b.timestamp * 1000).toLocaleString()}</div>
        ${b.problem ? `<div class="problem-text">${inlineMath(b.problem)}</div>` : '<p class="note">The problem text for this block is not on record.</p>'}
        <h2>Block hash on each node</h2>${hashRows(b)}
        ${b.messages.length ? answersHtml(b) : ''}
        <details><summary>Block details</summary><div class="meta">Parent hash: ${esc(b.parentHash)}<br>Stored message data: ${b.extraDataBytes} bytes</div></details></div>
        <h2>Deliberation stored in this block</h2>${transcriptHtml(b.messages)}`;
});

/* ---------- loop ---------- */
let view = 'run';
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    view = t.dataset.view;
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-pressed', x === t));
    $('view-run').hidden = view !== 'run';
    $('view-chain').hidden = view !== 'chain';
    if (view === 'chain') loadChain();
}));
let polling = false;
async function poll() {
    if (polling) return;
    polling = true;
    try {
        const s = await api('state');
        drawNetwork(s);
        drawBanner(s);
        if (view === 'run') drawRun(s);
        else loadChain();
    } catch (e) {
        $('network').innerHTML = '<span class="notgood">UI server not reachable</span>';
    }
    polling = false;
}
api('problems').then(list => {
    problems = list;
    selectedId = list[0] ? list[0].id : null;
    if (list[0]) $('problem').value = list[0].problem;
    drawPool();
});
poll();
setInterval(poll, 1000);
