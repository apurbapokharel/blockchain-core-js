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
        const value = r.unclear ? 'Unclear' : r.label !== undefined ? esc(r.raw)
            : math(r.raw.replace(/(^|[^\\])\$/g, '$1\\$'), false);
        const equal = r.label ? `<div class="tag">${esc(r.label)}</div>`
            : !r.unclear && typeof r.value === 'number' && String(r.value) !== r.raw ? `<div class="tag">= ${esc(+r.value.toFixed(4))}</div>` : '';
        return `<div class="answer ${r.unclear ? 'unclear' : ''}" style="--c:${color(r.node)}">
            <div class="who">Node ${r.node}</div><div class="val">${value}</div>${equal}${verdict}</div>`;
    }).join('');
    const summary = a.agree ? 'All nodes state the same final answer.'
        : a.unclearCount ? `${a.unclearCount} of ${a.rows.length} nodes gave no clear final answer.` : 'The nodes state different final answers.';
    return `<h2>Final answers</h2><div class="answers">${cards}</div><p class="note">${summary}</p>
        ${known ? `<div class="correct">Correct answer: <strong>${esc(known.answerText || known.answer)}</strong></div>` : ''}`;
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

/* ---------- icons (Font Awesome 6, from react-icons) ---------- */
const ICON = {
    robot: '<svg fill="currentColor" viewBox="0 0 640 512"><path d="M320 0c17.7 0 32 14.3 32 32l0 64 120 0c39.8 0 72 32.2 72 72l0 272c0 39.8-32.2 72-72 72l-304 0c-39.8 0-72-32.2-72-72l0-272c0-39.8 32.2-72 72-72l120 0 0-64c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224l16 0 0 192-16 0c-26.5 0-48-21.5-48-48l0-96c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48l0 96c0 26.5-21.5 48-48 48l-16 0 0-192 16 0z"/></svg>',
    med: '<svg fill="currentColor" viewBox="0 0 576 512"><path d="M142.4 21.9c5.6 16.8-3.5 34.9-20.2 40.5L96 71.1 96 192c0 53 43 96 96 96s96-43 96-96l0-120.9-26.1-8.7c-16.8-5.6-25.8-23.7-20.2-40.5s23.7-25.8 40.5-20.2l26.1 8.7C334.4 19.1 352 43.5 352 71.1L352 192c0 77.2-54.6 141.6-127.3 156.7C231 404.6 278.4 448 336 448c61.9 0 112-50.1 112-112l0-70.7c-28.3-12.3-48-40.5-48-73.3c0-44.2 35.8-80 80-80s80 35.8 80 80c0 32.8-19.7 61-48 73.3l0 70.7c0 97.2-78.8 176-176 176c-92.9 0-168.9-71.9-175.5-163.1C87.2 334.2 32 269.6 32 192L32 71.1c0-27.5 17.6-52 43.8-60.7l26.1-8.7c16.8-5.6 34.9 3.5 40.5 20.2zM480 224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',
    law: '<svg fill="currentColor" viewBox="0 0 640 512"><path d="M384 32l128 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L398.4 96c-5.2 25.8-22.9 47.1-46.4 57.3L352 448l160 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0-192 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l160 0 0-294.7c-23.5-10.3-41.2-31.6-46.4-57.3L128 96c-17.7 0-32-14.3-32-32s14.3-32 32-32l128 0c14.6-19.4 37.8-32 64-32s49.4 12.6 64 32zm55.6 288l144.9 0L512 195.8 439.6 320zM512 416c-62.9 0-115.2-34-126-78.9c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C627.2 382 574.9 416 512 416zM126.8 195.8L54.4 320l144.9 0L126.8 195.8zM.9 337.1c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C242 382 189.7 416 126.8 416S11.7 382 .9 337.1z"/></svg>',
    cube: '<svg fill="currentColor" viewBox="0 0 512 512"><path d="M234.5 5.7c13.9-5 29.1-5 43.1 0l192 68.6C495 83.4 512 107.5 512 134.6l0 242.9c0 27-17 51.2-42.5 60.3l-192 68.6c-13.9 5-29.1 5-43.1 0l-192-68.6C17 428.6 0 404.5 0 377.4L0 134.6c0-27 17-51.2 42.5-60.3l192-68.6zM256 66L82.3 128 256 190l173.7-62L256 66zm32 368.6l160-57.1 0-188L288 246.6l0 188z"/></svg>',
    check: '<svg fill="currentColor" viewBox="0 0 448 512"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>',
};

/* ---------- landing page ---------- */
let problems = [];
let selectedId = null;
const rendered = {sealKey: null, transcriptKey: null, timelineKey: null};

function drawPool() {
    // One column per domain (medical, legal), with the source named once under the heading.
    const cases = problems.filter(p => p.group === 'case');
    const domains = [...new Set(cases.map(p => p.domain))];
    $('cases').innerHTML = domains.map(d => {
        const list = cases.filter(p => p.domain === d);
        const sources = [...new Set(list.map(p => p.source.replace(/ \(.*\)$/, '')))].join(', ');
        return `<div class="case-col"><div class="case-head"><span class="case-icon">${ICON[list[0].icon] || ICON.cube}</span>
            <span><span class="case-domain">${esc(d)}</span><span class="case-source">From: ${esc(sources)}</span></span></div>
            ${list.map(p => `<button type="button" class="case" data-id="${esc(p.id)}" aria-pressed="${p.id === selectedId}">
            <span class="case-title">${esc(p.title)}</span><span class="case-teaser">${esc(p.teaser || '')}</span></button>`).join('')}</div>`;
    }).join('');
    $('pool').innerHTML = problems.filter(p => p.group !== 'case').map(p =>
        `<button type="button" class="chip" data-id="${esc(p.id)}" aria-pressed="${p.id === selectedId}">${esc(p.title)}</button>`).join('');
}
function choose(id) {
    selectedId = id;
    $('problem').value = problems.find(p => p.id === selectedId).problem;
    $('rounds').value = 2;
    $('turns').value = 1;
    $('start-note').textContent = '';
    drawPool();
}
for (const box of ['cases', 'pool']) {
    $(box).addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(b.dataset.id); });
}
$('problem').addEventListener('input', () => {
    const p = problems.find(x => x.id === selectedId);
    if (p && p.problem !== $('problem').value) { selectedId = null; drawPool(); }
});
$('editor').addEventListener('submit', async e => {
    e.preventDefault();
    stopReplay();
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

/* ---------- graph view: agents on a ring, the next block in the middle ---------- */
// Coordinates are in a 1000 x 600 box. The graph scales with its width (CSS container units).
const GW = 1000, GH = 640, CX = 500, CY = 215;
const ringPos = (i, count) => {
    // The ring starts at the upper left, so for three agents the third one sits below the block.
    const a = -Math.PI / 2 - Math.PI / count + 2 * Math.PI * i / count;
    return [CX + 330 * Math.cos(a), CY + 210 * Math.sin(a)];
};
const at = ([x, y]) => `left:${x / GW * 100}%;top:${y / GH * 100}%`;
const graph = {ids: '', count: null, pos: {}};

function buildGraph(box, ids) {
    const pos = {};
    ids.forEach((id, i) => { pos[id] = ringPos(i, ids.length); });
    let lines = '';
    ids.forEach((a, i) => ids.slice(i + 1).forEach(b => {
        lines += `<line class="mesh" x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}"/>`;
    }));
    ids.forEach(a => { lines += `<line class="feed" x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${CX}" y2="${CY}"/>`; });
    box.innerHTML = `<svg viewBox="0 0 ${GW} ${GH}" preserveAspectRatio="none">${lines}</svg>
        <div class="g-block" style="${at([CX, CY])}"><span class="g-icon">${ICON.cube}</span>
          <div class="g-block-title">Next block</div><div class="g-block-sub"></div><div class="g-stack"></div></div>
        ${ids.map(id => `<div class="g-node ${pos[id][0] < 480 ? 'left' : ''}" data-n="${id}" style="--c:${color(id)};${at(pos[id])}">
          <div class="g-ring"></div><div class="g-disc">${ICON.robot}</div>
          <div class="g-think"><span class="dots"><span></span><span></span><span></span></span><span class="g-think-text"></span></div>
          <div class="g-under"><div class="g-label">Agent ${id}<span>on node ${id}</span></div>
          <div class="g-status"></div><div class="g-stance" hidden></div></div></div>`).join('')}`;
    return pos;
}
// A dot travels from one point to another, to show a reply moving between nodes.
function fly(box, from, to, c, delay) {
    const d = document.createElement('div');
    d.className = 'g-fly';
    d.style.cssText = `${at(from)};--c:${c}`;
    box.appendChild(d);
    d.getBoundingClientRect();
    setTimeout(() => { d.style.left = `${to[0] / GW * 100}%`; d.style.top = `${to[1] / GH * 100}%`; d.classList.add('go'); }, delay);
    setTimeout(() => d.remove(), delay + 1500);
}
function flash(el) { el.classList.remove('flash'); el.getBoundingClientRect(); el.classList.add('flash'); }

const isChoice = k => k && k.kind === 'choice';
function gistHtml(g) {
    if (!g) return '<span class="g-none">No clear answer yet</span>';
    if (g.label) return `<b>${esc(g.answer)}</b> ${esc(g.label)}`;
    const v = typeof g.value === 'number' ? +g.value.toFixed(4) : g.answer;
    return `<b>${esc(/^\\?\$/.test(g.answer) ? `$${v}` : v)}</b>`;
}
const sameGist = (a, b) => (a && a.answer) === (b && b.answer) || (a && b && a.value !== undefined && a.value === b.value);

function stepText(s, agents) {
    const who = s.speakingNode ? `Agent ${s.speakingNode} is thinking.` : '';
    if (s.phase === 'starting') return 'Sending the case to every node.';
    if (s.phase === 'running' && s.currentRound === 1) return `Round 1: each agent answers on its own. ${who}`;
    if (s.phase === 'running' && s.currentRound) return `Round ${s.currentRound}${s.turns > 1 || s.currentTurn > 1 ? `, turn ${s.currentTurn}` : ''}: each agent reads another agent's answer and can change its mind. ${who}`;
    if (s.phase === 'running') return who || 'The agents are taking turns.';
    if (s.phase === 'sealing') return 'Every agent has spoken, and every node holds every reply. Sealing the block.';
    if (s.phase === 'sealed' && s.block) {
        const a = s.block.answers;
        const same = s.block.allMatch ? `All ${s.block.hashes.length} nodes hold the same block.` : 'The nodes hold different blocks.';
        if (a && a.agree && a.rows.length) return `${same} All ${agents} agents agree on ${a.rows[0].label ? `${a.rows[0].raw}: ${a.rows[0].label}` : a.rows[0].raw.replace(/\\/g, '')}.`;
        return `${same} The agents do not all agree, and the block records that too.`;
    }
    return '';
}

function drawGraph(s) {
    const box = $('graph');
    const ids = s.nodes.map(n => n.index);
    if (graph.ids !== ids.join()) { graph.pos = buildGraph(box, ids); graph.ids = ids.join(); graph.count = null; }
    const pos = graph.pos;
    const t = s.transcript;
    const total = s.expected || 0;

    // A new reply flies from its agent to every other node and into the next block.
    if (graph.count !== null && t.length > graph.count) {
        const m = t[t.length - 1];
        if (m.node && pos[m.node]) {
            ids.filter(i => i !== m.node).forEach((i, k) => fly(box, pos[m.node], pos[i], color(m.node), k * 120));
            fly(box, pos[m.node], [CX, CY], color(m.node), 60);
            const stance = box.querySelector(`.g-node[data-n="${m.node}"] .g-stance`);
            if (stance) flash(stance);
        }
    }
    graph.count = t.length;

    const sealed = s.phase === 'sealed' && s.block;
    box.classList.toggle('sealed', !!sealed);
    for (const n of s.nodes) {
        const el = box.querySelector(`.g-node[data-n="${n.index}"]`);
        const speaking = s.speakingNode === n.index && s.phase === 'running';
        el.classList.toggle('speaking', speaking);
        el.classList.toggle('offline', !n.up);
        let status;
        if (!n.up) status = 'Offline';
        else if (speaking) status = 'Thinking';
        else if (s.phase === 'starting') status = 'Receiving the case';
        else if (s.phase === 'sealing') status = 'Sealing';
        else if (sealed) status = `Holds block ${s.block.number}`;
        else if (s.phase === 'running') status = `Waiting · holds ${n.held} of ${total}`;
        else status = '';
        el.querySelector('.g-status').innerHTML = sealed && n.up ? `<span class="g-ok">${ICON.check}</span>${status}` : esc(status);
        el.querySelector('.g-think-text').textContent = speaking ? fmt(s.now - s.lastReplyAt) : '';

        const mine = t.filter(m => m.node === n.index);
        const stance = el.querySelector('.g-stance');
        stance.hidden = !mine.length;
        if (mine.length) {
            const g = mine[mine.length - 1].gist;
            const changed = mine.length > 1 && !sameGist(g, mine[mine.length - 2].gist);
            const html = `${gistHtml(g)}${changed ? '<span class="g-changed">changed its mind</span>' : ''}`;
            if (stance.dataset.html !== html) { stance.dataset.html = html; stance.innerHTML = html; }
        }
    }
    box.querySelector('.g-block-title').textContent = sealed ? `Block ${s.block.number}` : 'Next block';
    box.querySelector('.g-block-sub').innerHTML = sealed
        ? `<span class="g-ok">${ICON.check}</span>Sealed on ${s.block.hashes.filter(h => h.hash === s.block.hash).length} nodes`
        : s.phase === 'sealing' ? 'Sealing' : `${t.length} of ${total} replies`;
    const stack = t.map(m => `<i style="--c:${color(m.node)}"></i>`).join('');
    if (box.querySelector('.g-stack').dataset.n !== String(t.length)) {
        box.querySelector('.g-stack').dataset.n = String(t.length);
        box.querySelector('.g-stack').innerHTML = stack;
    }
    $('step-text').textContent = stepText(s, ids.length);
}

function drawTimeline(s) {
    const key = s.transcript.map(m => m.key).join('|');
    if (key === rendered.timelineKey) return;
    rendered.timelineKey = key;
    const prev = {};
    $('timeline').innerHTML = s.transcript.map(m => {
        const before = prev[m.node];
        prev[m.node] = m.gist;
        const changed = before !== undefined && !sameGist(before, m.gist);
        const when = m.round === 1 ? 'Round 1' : m.round ? `Round ${m.round}${s.turns > 1 ? `, turn ${m.turn}` : ''}` : '';
        return `<li style="--c:${color(m.node)}"><span class="t-who">Agent ${m.node || '?'}</span><span class="t-when">${when}</span>
            <span class="t-say">${gistHtml(m.gist)}${changed ? '<span class="g-changed">changed its mind</span>' : ''}</span></li>`;
    }).join('');
    $('timeline-title').hidden = !s.transcript.length;
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
        <div class="seal-foot"><span class="note">Every reply below is ${s.replay ? '' : 'now '}stored in this block.</span>
        ${s.replay ? '<button class="secondary" id="stop-replay">Stop replay</button>' : '<button class="primary" id="new-run">New deliberation</button>'}</div>`;
}
$('seal').addEventListener('click', e => {
    if (e.target.id === 'new-run') api('new', {}).then(() => { window.scrollTo({top: 0}); $('problem').focus(); poll(); });
    if (e.target.id === 'stop-replay') stopReplay();
});
function drawTranscript(s) {
    const key = s.transcript.map(m => m.key).join('|');
    if (key === rendered.transcriptKey) return;
    rendered.transcriptKey = key;
    $('transcript').innerHTML = transcriptHtml(s.transcript);
    $('transcript-box').hidden = !s.transcript.length;
}
// The case text without the answer-format line, which is there for the agents.
const caseHtml = text => text.replace(/\n*Choose one option\.[^\n]*$/, '').split('\n').map(inlineMath).join('<br>');
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
        rendered.timelineKey = null;
        graph.count = null;
        return;
    }
    const k = problems.find(p => p.problem === s.problem);
    $('live-title').textContent = k ? `${k.domain || 'Math check'}: ${k.title}` : 'Custom problem';
    $('live-problem').innerHTML = caseHtml(s.problem || '');
    drawProgress(s);
    drawGraph(s);
    drawSeal(s);
    drawTimeline(s);
    drawTranscript(s);
}

/* ---------- landing art: the same graph, small, with replies moving around ---------- */
function drawHero() {
    const box = $('hero-art');
    box.classList.add('graph', 'sealed');
    const pos = buildGraph(box, [1, 2, 3]);
    box.querySelector('.g-block-sub').innerHTML = `<span class="g-ok">${ICON.check}</span>same on every node`;
    box.querySelector('.g-block-title').textContent = 'One block';
    let i = 0;
    const step = () => {
        if ($('stage-pick').hidden) return;
        const from = (i % 3) + 1;
        box.querySelectorAll('.g-node').forEach(n => n.classList.toggle('speaking', Number(n.dataset.n) === (i + 1) % 3 + 1));
        [1, 2, 3].filter(x => x !== from).forEach((x, k) => fly(box, pos[from], pos[x], color(from), k * 120));
        fly(box, pos[from], [CX, CY], color(from), 60);
        i++;
    };
    step();
    setInterval(step, 2600);
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
    const actions = b.messages.length ? `<div class="replay-actions">
        <button class="primary" data-replay="${b.number}">Replay this deliberation</button>
        <span class="note">${esc(sourceText(b.llm))}</span></div>` : '';
    $('block-detail').innerHTML = `${actions}<div class="seal ${b.allMatch ? 'match' : 'mismatch'}">
        <p class="verdict">${b.allMatch ? `Block ${b.number}: all ${b.hashes.length} nodes match` : `Block ${b.number}: nodes differ`}</p>
        <div class="seal-sub">${b.messages.length} messages · ${b.size} bytes · ${new Date(b.timestamp * 1000).toLocaleString()}</div>
        ${b.problem ? `<div class="problem-text">${inlineMath(b.problem)}</div>` : '<p class="note">The problem text for this block is not on record.</p>'}
        <h2>Block hash on each node</h2>${hashRows(b)}
        ${b.messages.length ? answersHtml(b) : ''}
        <details><summary>Block details</summary><div class="meta">Parent hash: ${esc(b.parentHash)}<br>Stored message data: ${b.extraDataBytes} bytes</div></details></div>
        <h2>Deliberation stored in this block</h2>${transcriptHtml(b.messages)}`;
});

$('block-detail').addEventListener('click', e => {
    const n = e.target.dataset && e.target.dataset.replay;
    if (n) startReplay([Number(n)], false);
});

/* ---------- replay of stored blocks ---------- */
// A replay plays a sealed block as if it were live. It runs only in this page, changes nothing on the
// nodes, and keeps a banner on screen that says it is a recording.
let replay = null;
let lastServer = null;
const sourceText = llm => llm === 'real' ? 'Recorded from a real AI run.'
    : llm === 'fake' ? 'Recorded from a test run with the stand-in LLM.' : 'Recorded run.';

function planFor(b) {
    const n = b.messages.length;
    const recorded = b.replyTimes && b.replyTimes.length === n ? b.replyTimes : null;
    const times = [];
    let t = 2500;
    for (let i = 0; i < n; i++) {
        // Recorded gaps are kept between 2 and 12 seconds. Without a record, longer replies think longer.
        const gap = recorded ? recorded[i] - (i ? recorded[i - 1] : 0) : 2500 + Math.min(6000, b.messages[i].text.length * 3);
        t += Math.min(12000, Math.max(2000, gap));
        times.push(t);
    }
    const sealingAt = t + 1500, sealedAt = sealingAt + 2500;
    return {startMs: 2500, times, sealingAt, sealedAt, endAt: sealedAt + 15000};
}
function beginReplayBlock() {
    replay.block = replay.blocks[replay.index];
    replay.plan = planFor(replay.block);
    replay.t0 = Date.now();
    rendered.sealKey = null;
    rendered.transcriptKey = null;
}
async function startReplay(numbers, loop) {
    const blocks = [];
    for (const n of numbers) {
        try { const b = await api(`blocks/${n}`); if (b && b.messages.length) blocks.push(b); } catch (e) { /* skip */ }
    }
    if (!blocks.length) return;
    replay = {blocks, index: 0, loop};
    beginReplayBlock();
    showView('run');
    poll();
}
function stopReplay() {
    if (!replay) return;
    replay = null;
    rendered.sealKey = null;
    rendered.transcriptKey = null;
    $('banner').hidden = true;
    $('banner').dataset.text = '';
    document.documentElement.style.removeProperty('--banner-h');
    poll();
}
function replayState(server) {
    const {block: b, plan} = replay;
    let t = Date.now() - replay.t0;
    if (t >= plan.endAt && replay.loop) {
        replay.index = (replay.index + 1) % replay.blocks.length;
        beginReplayBlock();
        t = 0;
    }
    const shown = plan.times.filter(x => x <= t).length;
    const phase = t < plan.startMs ? 'starting' : shown < b.messages.length ? 'running' : t < plan.sealedAt ? 'sealing' : 'sealed';
    const next = b.messages[shown];
    const sealed = phase === 'sealed';
    return {
        replay: true, now: Date.now(), phase, error: null, problem: b.problem || 'Recorded deliberation', known: b.known,
        rounds: b.rounds, turns: b.turns,
        expected: b.messages.length, stalled: false,
        // Once sealed, the times are those of the recorded run, not of the replay.
        startedAt: sealed && b.startedAt ? b.startedAt : replay.t0,
        finishedAt: sealed && b.finishedAt ? b.finishedAt : replay.t0 + plan.sealingAt,
        lastReplyAt: replay.t0 + (shown ? plan.times[shown - 1] : plan.startMs),
        speakingNode: phase === 'running' ? next.node : null,
        currentRound: phase === 'running' ? next.round : null, currentTurn: phase === 'running' ? next.turn : null,
        transcript: phase === 'starting' ? [] : b.messages.slice(0, shown),
        block: sealed ? b : null,
        nodes: (server ? server.nodes : []).map(n => ({...n, held: phase === 'starting' ? 0 : shown})),
    };
}
function drawReplayBanner() {
    const b = $('banner');
    const blk = replay.block;
    const text = `Replay of block ${blk.number}, sealed ${new Date(blk.timestamp * 1000).toLocaleString()}. ${sourceText(blk.llm)}`
        + (replay.loop ? ` Looping through ${replay.blocks.length} recorded run${replay.blocks.length > 1 ? 's' : ''}.` : '');
    b.hidden = false;
    b.className = 'banner replay';
    if (b.dataset.text !== text) {
        b.dataset.text = text;
        b.innerHTML = `<span>${esc(text)}</span><button class="secondary" id="stop-replay">Stop replay</button>`;
    }
    // The sticky node cards sit just under the sticky replay banner.
    document.documentElement.style.setProperty('--banner-h', `${b.offsetHeight + 8}px`);
}
$('banner').addEventListener('click', e => { if (e.target.id === 'stop-replay') stopReplay(); });
$('replay-loop').addEventListener('click', async () => {
    let blocks = [];
    try { blocks = await api('blocks'); } catch (e) { /* none */ }
    const real = blocks.filter(b => b.llm === 'real').map(b => b.number).sort((a, b) => a - b);
    if (!real.length) { $('start-note').textContent = 'No block from a real AI run is stored yet.'; return; }
    startReplay(real, true);
});

/* ---------- loop ---------- */
let view = 'run';
function showView(v) {
    view = v;
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-pressed', x.dataset.view === v));
    $('view-run').hidden = view !== 'run';
    $('view-chain').hidden = view !== 'chain';
    if (view === 'chain') loadChain();
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
let polling = false;
async function poll() {
    if (polling) return;
    polling = true;
    try {
        const s = await api('state');
        lastServer = s;
        drawNetwork(s);
        if (replay) drawReplayBanner(); else drawBanner(s);
        if (view === 'run') drawRun(replay ? replayState(s) : s);
        else loadChain();
    } catch (e) {
        $('network').innerHTML = '<span class="notgood">UI server not reachable</span>';
        // A replay keeps playing from the last known node list.
        if (replay && view === 'run') { drawReplayBanner(); drawRun(replayState(lastServer)); }
    }
    polling = false;
}
api('problems').then(list => {
    problems = list;
    if (list[0]) choose(list[0].id);
});
drawHero();
poll();
setInterval(poll, 1000);
// The case text shows two lines during a run. A click shows all of it.
$('live-problem').addEventListener('click', () => $('live-problem').classList.toggle('open'));
