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
    // The poster speaks to people who do not know what a blockchain is. It says "shared record" instead.
    text('AI agents debate until they all agree, and every party keeps the same unchangeable record.', {x: 0.6, y: 6.55,
        w: 46.8, h: 1.4, fontFace: HEAD, fontSize: 50, color: C.dark, align: 'center', valign: 'middle', objectName: 'Hook'});

    /* ---------- Panel A: the problem ---------- */
    panel(0.6, 8.5, 14.2, 13.5, 'The problem', 'Problem panel');
    const rows = [
        ['FaRobot', 'One AI can be wrong', 'A single AI model gives one answer, with no second opinion.'],
        ['FaCheckToSlot', 'Voting is not agreement', 'Group decisions count votes. The minority is overruled, not convinced.'],
        ['FaFileCircleQuestion', 'No trusted record', 'Later, nobody can prove what was decided or why.'],
    ];
    for (let i = 0; i < rows.length; i++) {
        const y = 10.6 + i * 3.0;
        await iconCircle(1.2, y, 1.5, rows[i][0], C.olive);
        text([{text: rows[i][1], options: {bold: true, fontSize: 38, breakLine: true}},
            {text: rows[i][2], options: {fontSize: 32, color: C.muted}}],
            {x: 3.05, y: y - 0.05, w: 11.15, h: 2.8, paraSpaceAfter: 6, objectName: 'Problem ' + (i + 1)});
    }
    text('Hospitals, courts, and agencies need decisions that every party accepts, with proof of why.',
        {x: 1.2, y: 19.6, w: 13.0, h: 2.2, fontSize: 32, italic: true, bold: true, color: C.green,
            objectName: 'Problem summary'});

    /* ---------- Panel B: the idea ---------- */
    panel(15.4, 8.5, 17.2, 13.5, 'Our idea: AI agents that must agree', 'Idea panel');
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
    text('debate\nin turns', {x: 19.3, y: 14.75, w: 2.6, h: 1.5, fontSize: 30, italic: true, color: C.muted,
        align: 'center', valign: 'middle', objectName: 'Turns label'});
    s.addShape(pres.shapes.LINE, {x: 25.3, y: 14.4, w: 1.6, h: 0, line: {color: C.dark, width: 6, endArrowType: 'triangle'},
        objectName: 'Record arrow'});
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: 27.1, y: 10.75, w: 4.9, h: 6.9, rectRadius: 0.2,
        fill: {color: C.dark}, line: {type: 'none'}, objectName: 'Shared record'});
    s.addImage({data: await icon('FaFileShield', 'E3EED0'), x: 28.95, y: 11.05, w: 1.2, h: 1.2});
    text('One shared record', {x: 27.1, y: 12.4, w: 4.9, h: 0.7, fontSize: 30, bold: true, color: C.white,
        align: 'center', objectName: 'Record title'});
    text('every argument, every turn', {x: 27.1, y: 13.1, w: 4.9, h: 0.6, fontSize: 22, color: 'D6E4C4',
        align: 'center', objectName: 'Record subtitle'});
    [C.n1, C.n2, C.n3].forEach((col, i) => {
        const y = 14.0 + i * 1.12;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: 27.45, y, w: 4.2, h: 0.9, rectRadius: 0.1,
            fill: {color: C.white}, line: {color: col, width: 3}});
        text([{text: `Party ${i + 1}  `, options: {bold: true, color: col}}, {text: 'same copy', options: {color: C.ink}}],
            {x: 27.45, y, w: 4.2, h: 0.9, fontSize: 24, align: 'center', valign: 'middle', objectName: `Copy chip ${i + 1}`});
    });
    const steps = ['Ask a team of AI agents a hard question.', 'Each agent answers, reads the others, and can change its mind.',
        'When all agree, every party stores the same record. Nobody can change it later.'];
    for (let i = 0; i < 3; i++) {
        const x = 16.0 + i * 5.55;
        s.addShape(pres.shapes.OVAL, {x, y: 18.8, w: 1.0, h: 1.0, fill: {color: C.green}, line: {type: 'none'}});
        text(String(i + 1), {x, y: 18.8, w: 1.0, h: 1.0, fontFace: HEAD, fontSize: 30, color: C.white,
            align: 'center', valign: 'middle'});
        text(steps[i], {x: x + 1.2, y: 18.75, w: 4.2, h: 3.1, fontSize: 26, objectName: `Step ${i + 1}`});
    }

    /* ---------- Panel C: an example ---------- */
    panel(33.2, 8.5, 14.2, 13.5, 'Example: a diagnosis', 'Example panel');
    await iconCircle(33.8, 10.45, 1.5, 'FaStethoscope', C.olive);
    text('A patient has a fever, a rash, and pain behind the eyes.', {x: 35.6, y: 10.4, w: 11.2, h: 1.6,
        fontSize: 32, bold: true, valign: 'middle', objectName: 'Example case'});
    const chipRow = async (y, label, items) => {
        text(label, {x: 33.8, y, w: 13.0, h: 0.6, fontSize: 26, bold: true, color: C.muted, objectName: label});
        items.forEach(([who, say, col, changed], i) => {
            const x = 33.8 + i * 4.43;
            s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x, y: y + 0.7, w: 4.13, h: 1.5, rectRadius: 0.12,
                fill: {color: changed ? 'FBF0D4' : C.white}, line: {color: col, width: 3}});
            text([{text: who, options: {bold: true, color: col, fontSize: 24, breakLine: true}},
                {text: say, options: {bold: true, fontSize: 30}}],
                {x, y: y + 0.7, w: 4.13, h: 1.5, align: 'center', valign: 'middle', objectName: `${label} ${who}`});
        });
    };
    await chipRow(12.3, 'Round 1: each agent answers alone',
        [['AI agent 1', 'Malaria', C.n1], ['AI agent 2', 'Dengue', C.n2], ['AI agent 3', 'Dengue', C.n3]]);
    await chipRow(14.75, 'Round 2: each agent reads the others',
        [['AI agent 1', 'Dengue', C.n1, true], ['AI agent 2', 'Dengue', C.n2], ['AI agent 3', 'Dengue', C.n3]]);
    text('Agent 1 changes its mind: "The rash and eye pain fit dengue better."', {x: 33.8, y: 17.05, w: 13.0, h: 0.9,
        fontSize: 26, italic: true, color: '8A5A00', objectName: 'Change of mind'});
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x: 33.8, y: 18.1, w: 13.0, h: 3.6, rectRadius: 0.15,
        fill: {color: C.dark}, line: {type: 'none'}, objectName: 'Example result'});
    text([{text: 'All agree: dengue', options: {bold: true, fontSize: 40, breakLine: true}},
        {text: 'The doctor, the hospital, and the insurer each keep the same record. They see why, not only what.',
            options: {fontSize: 28, color: 'D6E4C4'}}],
        {x: 34.3, y: 18.25, w: 12.0, h: 3.3, color: C.white, valign: 'middle', paraSpaceAfter: 6, objectName: 'Example result text'});

    /* ---------- Panel D: who benefits ---------- */
    panel(0.6, 22.6, 23.1, 12.8, 'Who benefits', 'Users panel');
    const users = [
        ['FaUserDoctor', 'Doctors and hospitals', 'A second and third opinion from AI, with the reasoning kept for review.'],
        ['FaScaleBalanced', 'Courts and legal teams', 'Every argument is on record, and the reasons for a ruling cannot change later.'],
        ['FaLandmark', 'Government agencies', 'Departments reach one policy decision that all of them accept.'],
        ['FaBuilding', 'Companies that use AI', 'No single AI model decides alone, and auditors can replay every step.'],
    ];
    for (let i = 0; i < users.length; i++) {
        const x = 1.2 + (i % 2) * 11.1, y = 24.6 + Math.floor(i / 2) * 4.55;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, {x, y, w: 10.8, h: 4.25, rectRadius: 0.15, fill: {color: C.white},
            line: {color: 'C9D8B0', width: 1.5}, objectName: `User ${i + 1} card`});
        await iconCircle(x + 0.4, y + (4.25 - 1.6) / 2, 1.6, users[i][0], C.green);
        text([{text: users[i][1], options: {bold: true, fontSize: 36, breakLine: true}},
            {text: users[i][2], options: {fontSize: 30, color: C.muted}}],
            {x: x + 2.3, y: y + 0.3, w: 8.2, h: 3.65, valign: 'middle', paraSpaceAfter: 8, objectName: `User ${i + 1}`});
    }
    text('Anyone who must decide together, and prove it later.', {x: 1.2, y: 33.85, w: 21.9, h: 0.95,
        fontSize: 32, italic: true, bold: true, color: C.green, align: 'center', valign: 'middle', objectName: 'Users summary'});

    /* ---------- Panel E: what they gain ---------- */
    panel(24.3, 22.6, 23.1, 12.8, 'What they gain', 'Benefits panel');
    const gains = [
        ['FaLightbulb', 'Better answers', 'The agents catch each other\'s mistakes before they agree.'],
        ['FaHandshake', 'Real agreement, not a vote', 'The decision stands only when every agent accepts it.'],
        ['FaFileShield', 'A record nobody can change', 'Every argument is stored, so anyone can check how the decision was made.'],
        ['FaCopy', 'No single owner', 'Each party keeps its own identical copy of the record.'],
    ];
    for (let i = 0; i < gains.length; i++) {
        const y = 24.5 + i * 2.3;
        await iconCircle(24.9, y + 0.15, 1.5, gains[i][0], C.olive);
        text([{text: gains[i][1], options: {bold: true, fontSize: 36, breakLine: true}},
            {text: gains[i][2], options: {fontSize: 30, color: C.muted}}],
            {x: 26.75, y, w: 20.1, h: 2.2, valign: 'middle', objectName: `Gain ${i + 1}`});
    }
    text('Live demo: three AI agents reach one shared record in about 2 minutes. Ask us to run it.', {x: 24.9, y: 33.85,
        w: 21.9, h: 0.95, fontFace: HEAD, fontSize: 32, color: C.green, align: 'center', valign: 'middle', objectName: 'Call to action'});

    await pres.writeFile({fileName: OUT});
    console.log('wrote', OUT);
})().catch(e => { console.error(e); process.exit(1); });
