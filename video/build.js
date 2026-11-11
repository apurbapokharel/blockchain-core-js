// Builds the 60 s looping poster video, video/deliberation-demo.mp4, at 1920 x 1080 and 30 fps, with no sound.
// Scenes 1-3 and 5 come from video/scenes.html. The demo scene (30 to 50 s) is the UI's replay of a stored block,
// recorded with a controlled clock, so the demo UI must be running (./demo start, no GPU needed for a replay).
//
// Usage:
//   NODE_PATH=<node_modules> FFMPEG=<ffmpeg binary> node video/build.js full
//   NODE_PATH=<node_modules> node video/build.js preview 4 12 22 28.5 35 44 55   (stills, in seconds)
// Packages: puppeteer-core react react-dom react-icons. Chrome: /usr/bin/google-chrome.
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const puppeteer = require('puppeteer-core');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const fa = require('react-icons/fa6');

const FPS = 30, LENGTH = 60, DEMO = [30, 50];
const UI = process.env.DEMO_UI_URL || 'http://127.0.0.1:8700/';
const BLOCK = Number(process.env.REPLAY_BLOCK || 3); // block 3 is the real model run of 2026-11-06
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, 'out');
const VIDEO = path.join(__dirname, 'deliberation-demo.mp4');

// Demo captions, in seconds from the start of the demo scene.
const DEMO_CAPTIONS = [
    [0, 6, 'A recorded run with three real AI agents, sped up.'],
    [6, 12.5, 'Each reply reaches every node as the agents take turns.'],
    [12.5, 20, 'When the debate ends, one block seals it all, and every node holds the same hash.'],
];
const SEAL_AT = 13.5; // demo second at which the replay reaches the sealed block

const ICONS = Object.fromEntries(['FaCheckToSlot', 'FaBolt', 'FaGaugeHigh', 'FaRobot', 'FaCube']
    .map(n => [n, renderToStaticMarkup(React.createElement(fa[n], {size: '100%'}))]));

// Runs in the UI page before its own script: a clock that only moves when the recorder says so,
// no polling timer, no replay banner, smooth scrolling driven per frame, and a caption bar.
function uiInit() {
    const base = Date.now();
    let clock = 0;
    Date.now = () => base + clock;
    window.__setClock = ms => { clock = ms; };
    window.setInterval = () => 0;
    const realScrollTo = window.scrollTo.bind(window);
    let target = 0, current = 0;
    Element.prototype.scrollIntoView = function () {
        const r = this.getBoundingClientRect(), limit = innerHeight - 140;
        if (r.bottom > limit) target = scrollY + r.bottom - limit;
    };
    window.scrollTo = o => { target = o && typeof o === 'object' ? o.top || 0 : 0; };
    window.__scrollStep = () => {
        current += (target - current) * 0.2;
        realScrollTo(0, current);
    };
    document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = `#banner,#stop-replay{display:none!important}.cards.sticky{top:0!important}
            #vcap{position:fixed;left:0;right:0;bottom:45px;text-align:center;z-index:50;pointer-events:none}
            #vcap span{display:inline-block;max-width:1312px;background:rgba(0,0,0,.78);color:#fff;font:40px/1.3 Arial,"Liberation Sans",sans-serif;padding:13px 27px;border-radius:11px}`;
        document.head.appendChild(st);
        const cap = document.createElement('div');
        cap.id = 'vcap';
        document.body.appendChild(cap);
    });
}

async function main() {
    const [mode, ...times] = process.argv.slice(2);
    if (!['full', 'preview'].includes(mode)) throw new Error('Usage: build.js full | preview <seconds...>');
    fs.mkdirSync(OUT_DIR, {recursive: true});
    // One browser per page: Chrome does not paint a background tab, so its screenshots stall.
    const launch = () => puppeteer.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
    const browsers = [await launch(), await launch()];

    const scenes = await browsers[0].newPage();
    await scenes.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
    await scenes.goto('file://' + path.join(__dirname, 'scenes.html'));
    await scenes.evaluate(icons => setup(icons), ICONS);

    const ui = await browsers[1].newPage();
    await ui.setViewport({width: 1536, height: 864, deviceScaleFactor: 1.25});
    await ui.evaluateOnNewDocument(uiInit);
    await ui.goto(UI, {waitUntil: 'networkidle0'});
    await ui.evaluate(async n => { await poll(); await startReplay([n], false); await poll(); }, BLOCK);
    const sealedAt = await ui.evaluate(() => replay.plan.sealedAt);
    const replayMs = v => v < SEAL_AT ? v / SEAL_AT * (sealedAt + 600) : sealedAt + 600 + (v - SEAL_AT) * 1000;

    const frame = async (t, file) => {
        if (t >= DEMO[0] && t < DEMO[1]) {
            const v = t - DEMO[0];
            const cap = DEMO_CAPTIONS.find(([a, b]) => v >= a && v < b);
            await ui.evaluate(async (ms, text) => {
                window.__setClock(ms);
                await poll();
                window.__scrollStep();
                document.getElementById('vcap').innerHTML = text ? `<span>${text}</span>` : '';
            }, replayMs(v), cap ? cap[2] : '');
            await ui.screenshot({path: file, type: 'jpeg', quality: 92});
        } else {
            await scenes.evaluate(x => render(x), t);
            await scenes.screenshot({path: file, type: 'jpeg', quality: 92});
        }
    };

    if (mode === 'preview') {
        // The demo is stateful (scrolling), so preview stills inside it step through the demo up to that time.
        let demoV = 0;
        for (const s of times.map(Number).sort((a, b) => a - b)) {
            if (s >= DEMO[0] && s < DEMO[1]) {
                for (; demoV < s - DEMO[0]; demoV += 1 / FPS) await frame(DEMO[0] + demoV, path.join(OUT_DIR, 'tmp.jpg'));
            }
            await frame(s, path.join(OUT_DIR, `preview-${s}.jpg`));
            console.log('preview', s);
        }
    } else {
        const dir = path.join(OUT_DIR, 'frames');
        fs.rmSync(dir, {recursive: true, force: true});
        fs.mkdirSync(dir);
        for (let f = 0; f < FPS * LENGTH; f++) {
            await frame(f / FPS, path.join(dir, String(f).padStart(5, '0') + '.jpg'));
            if (f % 150 === 0) console.log(`frame ${f} of ${FPS * LENGTH}`);
        }
        execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS),
            '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', VIDEO], {stdio: 'inherit'});
        console.log('wrote', VIDEO);
    }
    for (const b of browsers) await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
