// Builds poster/poster.pptx (48 x 36 inches) from the files in poster/assets.
// Usage: NODE_PATH=<folder with node_modules> node poster/build.js
// The packages it needs: pptxgenjs react react-dom react-icons sharp
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');

const A = f => path.join(__dirname, 'assets', f);
const OUT = path.join(__dirname, 'poster.pptx');

// Template colors (from the reference poster), plus the node colors of the demo UI.
const C = {
    bg: 'C5D99B', panel: 'EEF4E0', green: '22802D', olive: '6E8A35', dark: '1C3A21',
    ink: '1B2220', muted: '4A5650', white: 'FFFFFF',
    n1: '1F6FB2', n2: 'B4531F', n3: '6B4BB5',
};
// Headings use bold Arial: it prints the same from PowerPoint and from LibreOffice.
const HEAD = 'Arial', BODY = 'Arial';

async function icon(name, color, px = 512) {
    const svg = renderToStaticMarkup(React.createElement(fa[name], {color: '#' + color, size: px}));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return 'image/png;base64,' + png.toString('base64');
}

(async () => {
    const pres = new pptxgen();
    pres.defineLayout({name: 'POSTER', width: 48, height: 36});
    pres.layout = 'POSTER';
    pres.title = 'Achieving Unanimous Consensus in Blockchain with Multi-Agent Deliberation';
    pres.author = 'Apurba Pokharel and Ram Dantu';
    pres.theme = {headFontFace: HEAD, bodyFontFace: BODY};
    const s = pres.addSlide();
    s.background = {color: C.bg};

    const text = (t, o) => s.addText(t, {isTextBox: true, fontFace: BODY, color: C.ink, margin: 0, valign: 'top',
        ...o, ...(o.fontFace === HEAD ? {bold: true} : {})});
    const panel = (x, y, w, h, title, name) => {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x, y, w, h, rectRadius: 0.25, fill: {color: C.panel},
            line: {color: C.olive, width: 2}, objectName: name});
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: x + 0.6, y: y + 0.5, w: w - 1.2, h: 1.3, rectRadius: 0.15,
            fill: {color: C.green}, line: {type: 'none'}, objectName: name + ' header'});
        text(title, {x: x + 0.6, y: y + 0.5, w: w - 1.2, h: 1.3, fontFace: HEAD, fontSize: 44, color: C.white,
            align: 'center', valign: 'middle', objectName: name + ' title'});
    };
    const iconCircle = async (x, y, d, name, fill, color = C.white) => {
        s.addShape(pres.shapes.OVAL, {x, y, w: d, h: d, fill: {color: fill}, line: {type: 'none'}});
        s.addImage({data: await icon(name, color), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52});
    };

    /* ---------- Title band ---------- */
    s.addShape(pres.shapes.RECTANGLE, {x: 0.6, y: 0.5, w: 46.8, h: 5.6, fill: {color: C.green}, line: {type: 'none'},
        objectName: 'Title band'});
    s.addImage({path: A('headshot-left.png'), x: 1.3, y: 0.9, w: 4.25, h: 4.8, objectName: 'Author photo left'});
    s.addImage({path: A('headshot-right.png'), x: 42.87, y: 0.9, w: 3.83, h: 4.8, objectName: 'Author photo right'});
    text('Achieving Unanimous Consensus in Blockchain\nwith Multi-Agent Deliberation', {x: 6.2, y: 0.85, w: 35.6, h: 2.7,
        fontFace: HEAD, fontSize: 66, color: C.white, align: 'center', valign: 'middle', objectName: 'Title'});
    text('Apurba Pokharel and Ram Dantu', {x: 6.2, y: 3.75, w: 35.6, h: 0.9, fontSize: 38, bold: true,
        color: C.white, align: 'center', objectName: 'Authors'});
    text('Network Security Labs, University of North Texas', {x: 6.2, y: 4.75, w: 35.6, h: 0.8, fontSize: 32,
        color: 'E3EED0', align: 'center', objectName: 'Affiliation'});

    /* ---------- Hook ---------- */
    text('Blockchains agree on data. We make them agree on decisions.', {x: 0.6, y: 6.55, w: 46.8, h: 1.4,
        fontFace: HEAD, fontSize: 54, color: C.dark, align: 'center', valign: 'middle', objectName: 'Hook'});

    /* ---------- Panel A: the problem ---------- */
    panel(0.6, 8.5, 14.2, 13.5, 'The problem', 'Problem panel');
    const rows = [
        ['FaCheckToSlot', 'Majority vote', 'The minority is overruled, not convinced.'],
        ['FaBolt', 'Fastest or richest leads', 'Proof of work and proof of stake pick a leader. Nobody reasons.'],
        ['FaGaugeHigh', 'Built for speed', 'Fast agreement on transactions, not on hard questions.'],
    ];
    for (let i = 0; i < rows.length; i++) {
        const y = 10.7 + i * 3.0;
        await iconCircle(1.2, y, 1.5, rows[i][0], C.olive);
        text([{text: rows[i][1], options: {bold: true, fontSize: 38, breakLine: true}},
            {text: rows[i][2], options: {fontSize: 32, color: C.muted}}],
            {x: 3.05, y: y - 0.05, w: 11.15, h: 2.8, paraSpaceAfter: 6, objectName: 'Problem ' + (i + 1)});
    }
    text('Policy, legal review, and proofs need every party to agree, and a record of why.',
        {x: 1.2, y: 19.7, w: 13.0, h: 2.0, fontSize: 32, italic: true, bold: true, color: C.green,
            objectName: 'Problem summary'});

    /* ---------- Panel B: the idea ---------- */
    panel(15.4, 8.5, 17.2, 13.5, 'Our idea: deliberation as consensus', 'Idea panel');
    const D = 2.5, R = D / 2;
    const agents = [[20.6, 12.35, C.n1], [23.55, 16.45, C.n2], [17.65, 16.45, C.n3]]; // centers
    for (let i = 0; i < 3; i++) {
        const [ax, ay] = agents[i], [bx, by] = agents[(i + 1) % 3];
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), k = (R + 0.2) / L;
        const x1 = ax + dx * k, y1 = ay + dy * k, x2 = bx - dx * k, y2 = by - dy * k;
        s.addShape(pres.shapes.LINE, {x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.01,
            h: Math.abs(y2 - y1) || 0.01, flipH: x2 < x1, flipV: y2 < y1,
            line: {color: C.dark, width: 5, endArrowType: 'triangle'}, objectName: 'Turn arrow ' + (i + 1)});
    }
    for (let i = 0; i < 3; i++) {
        const [cx, cy, col] = agents[i];
        await iconCircle(cx - R, cy - R, D, 'FaRobot', col);
        // The top agent's label sits at its left, so that it clears the panel header.
        const at = i === 0 ? {x: cx - R - 4.3, y: cy - 0.4, w: 4.1, align: 'right'} : {x: cx - 2.2, y: cy + R + 0.1, w: 4.4, align: 'center'};
        text(`AI agent ${i + 1}`, {...at, h: 0.8, fontSize: 30, bold: true, color: col, objectName: `Agent ${i + 1} label`});
    }
    text('takes\nturns', {x: 19.3, y: 14.75, w: 2.6, h: 1.5, fontSize: 30, italic: true, color: C.muted,
        align: 'center', valign: 'middle', objectName: 'Turns label'});
    // Arrow from the agents to the block.
    s.addShape(pres.shapes.LINE, {x: 25.3, y: 14.4, w: 1.6, h: 0, line: {color: C.dark, width: 6, endArrowType: 'triangle'},
        objectName: 'Seal arrow'});
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: 27.1, y: 10.75, w: 4.9, h: 6.9, rectRadius: 0.2,
        fill: {color: C.dark}, line: {type: 'none'}, objectName: 'Block'});
    s.addImage({data: await icon('FaCube', 'E3EED0'), x: 28.95, y: 11.05, w: 1.2, h: 1.2});
    text('One sealed block', {x: 27.1, y: 12.4, w: 4.9, h: 0.7, fontSize: 30, bold: true, color: C.white,
        align: 'center', objectName: 'Block title'});
    text('every reply, every turn', {x: 27.1, y: 13.1, w: 4.9, h: 0.6, fontSize: 22, color: 'D6E4C4',
        align: 'center', objectName: 'Block subtitle'});
    [C.n1, C.n2, C.n3].forEach((col, i) => {
        const y = 14.0 + i * 1.12;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: 27.45, y, w: 4.2, h: 0.9, rectRadius: 0.1,
            fill: {color: C.white}, line: {color: col, width: 3}});
        text([{text: `Node ${i + 1}  `, options: {bold: true, color: col}}, {text: '#85b3…313a', options: {fontFace: 'Courier New'}}],
            {x: 27.45, y, w: 4.2, h: 0.9, fontSize: 21, align: 'center', valign: 'middle', objectName: `Hash chip ${i + 1}`});
    });
    const steps = ['Post a problem to the chain.', 'AI agents answer in turns, each reading the others.',
        'When the debate ends, every node seals the same block.'];
    for (let i = 0; i < 3; i++) {
        const x = 16.0 + i * 5.55;
        s.addShape(pres.shapes.OVAL, {x, y: 18.8, w: 1.0, h: 1.0, fill: {color: C.green}, line: {type: 'none'}});
        text(String(i + 1), {x, y: 18.8, w: 1.0, h: 1.0, fontFace: HEAD, fontSize: 30, color: C.white,
            align: 'center', valign: 'middle'});
        text(steps[i], {x: x + 1.2, y: 18.75, w: 4.2, h: 3.0, fontSize: 28, objectName: `Step ${i + 1}`});
    }

    /* ---------- Panel C: proof ---------- */
    panel(33.2, 8.5, 14.2, 13.5, 'Proof: one block, every node', 'Proof panel');
    s.addImage({path: A('sealed-block.png'), x: 33.8, y: 10.6, w: 13.0, h: 13.0 * 1782 / 2838,
        objectName: 'Screenshot of a sealed block'});
    text('A live run with three AI agents. All three nodes hold the identical block, and every agent reached the correct answer.',
        {x: 33.8, y: 19.0, w: 13.0, h: 2.8, fontSize: 32, objectName: 'Proof caption'});

    /* ---------- Panel D: the demo ---------- */
    panel(0.6, 22.6, 23.1, 12.8, 'Live demo, real AI agents', 'Demo panel');
    const stats = [['3', 'AI agents on\nthree nodes'], ['9', 'replies in\nabout 2 minutes'], ['1', 'block holds\nthe whole debate'],
        ['3/3', 'nodes with the\nsame block hash']];
    stats.forEach(([n, label], i) => {
        const x = 1.2 + i * 5.5;
        text(n, {x, y: 24.4, w: 5.2, h: 2.3, fontFace: HEAD, fontSize: 120, color: C.green, align: 'center',
            valign: 'middle', objectName: `Stat ${i + 1}`});
        text(label, {x, y: 26.85, w: 5.2, h: 1.9, fontSize: 30, color: C.muted, align: 'center',
            objectName: `Stat ${i + 1} label`});
    });
    // The chain motif: each deliberation becomes the next block.
    const blocks = ['Deliberation 1', 'Deliberation 2', 'Deliberation 3', 'Your problem?'];
    blocks.forEach((b, i) => {
        const x = 1.8 + i * 5.5, last = i === blocks.length - 1;
        if (i) s.addShape(pres.shapes.LINE, {x: x - 1.3, y: 30.9, w: 1.3, h: 0, line: {color: C.dark, width: 5}});
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x, y: 29.3, w: 4.0, h: 3.2, rectRadius: 0.15,
            fill: {color: last ? C.panel : C.dark}, line: last ? {color: C.dark, width: 3, dashType: 'dash'} : {type: 'none'}});
        text([{text: last ? 'Next block' : `Block ${i + 1}`, options: {bold: true, fontSize: 32, breakLine: true}},
            {text: b, options: {fontSize: 26}}],
            {x, y: 29.3, w: 4.0, h: 3.2, color: last ? C.dark : C.white, align: 'center', valign: 'middle',
                objectName: `Chain block ${i + 1}`});
    });
    text('Every finished deliberation becomes the next block in the chain.', {x: 1.2, y: 33.0, w: 21.9, h: 1.8,
        fontSize: 30, italic: true, color: C.muted, align: 'center', objectName: 'Chain caption'});

    /* ---------- Panel E: why it matters ---------- */
    panel(24.3, 22.6, 23.1, 12.8, 'Where every party must agree', 'Uses panel');
    const uses = [
        ['FaLandmark', 'Government policy', 'Agencies agree on a decision, with every argument on record.'],
        ['FaScaleBalanced', 'Legal review', 'Parties reach a ruling they all accept, and the reasoning cannot change later.'],
        ['FaSquareRootVariable', 'Theorem proving', 'Agents check each step until the proof holds for everyone.'],
        ['FaUsersGear', 'Shared AI decisions', 'Several AI agents, not one, stand behind the answer.'],
    ];
    for (let i = 0; i < uses.length; i++) {
        const x = 24.9 + (i % 2) * 11.1, y = 24.6 + Math.floor(i / 2) * 4.55;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x, y, w: 10.8, h: 4.25, rectRadius: 0.15, fill: {color: C.white},
            line: {color: 'C9D8B0', width: 1.5}, objectName: `Use ${i + 1} card`});
        await iconCircle(x + 0.4, y + (4.25 - 1.6) / 2, 1.6, uses[i][0], C.green);
        text([{text: uses[i][1], options: {bold: true, fontSize: 40, breakLine: true}},
            {text: uses[i][2], options: {fontSize: 33, color: C.muted}}],
            {x: x + 2.3, y: y + 0.3, w: 8.2, h: 3.65, valign: 'middle', paraSpaceAfter: 8, objectName: `Use ${i + 1}`});
    }
    text('Ask us for a live demo.', {x: 24.9, y: 33.85, w: 21.9, h: 0.95, fontFace: HEAD, fontSize: 40,
        color: C.green, align: 'center', valign: 'middle', objectName: 'Call to action'});

    await pres.writeFile({fileName: OUT});
    console.log('wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
