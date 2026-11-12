// Stands in for DefinitiveDeliberationServer.py on port 5000, so that the UI runs without a GPU.
const http = require('http');
const pool = require('./problems.json');
const sessions = new Map();
let counter = 0;

function reply(session) {
    const known = pool.find(p => p.problem === session.problem);
    const n = counter++;
    if (known && known.kind === 'choice') {
        // Most replies pick the right option, and every third one picks another, so the graph shows a change of mind.
        const letters = Object.keys(known.choices);
        const pick = n % 3 === 2 ? letters.find(l => l !== known.answer) : known.answer;
        return `## Step 1: Weigh the options\n\nThe agent compares each option with the facts.\n\n` +
            `**${pick}) ${known.choices[pick]}** fits best.\n\nFinal answer: ${pick}`;
    }
    const value = known ? known.value : 42;
    const forms = [`$\\boxed{${value}}$`, `$\\boxed{${value * 2}/2}$`, `the same value as before`];
    // The node turns each newline into a space, like a real reply.
    return `## Step 1: Read the problem\n\nThe agent restates the inputs, for example $7 and $10.\n\n## Step 2: Calculate\n\n` +
        `We use $x = \\frac{${value * 2}}{2}$ and **simplify** the result.\n\nThe final result is ${forms[n % 3]}`;
}
http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d).on('end', () => {
        const params = (JSON.parse(body || '{}').params) || {};
        const send = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
        if (req.url === '/init') {
            const id = String(Date.now()) + Math.random();
            sessions.set(id, {problem: params.problem});
            return send({session_id: id});
        }
        const session = sessions.get(params.session_id) || {};
        setTimeout(() => send({result: {response: reply(session)}}), 1500 + Math.random() * 1500);
    });
}).listen(5000, '127.0.0.1');
