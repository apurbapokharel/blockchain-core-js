# Poster and video plan

This file holds the plan for the conference poster and the demo video. Both pieces show the work at a high level.
Their job is to make people want to talk to us, so they leave out the details that are worth protecting.

Status on 2026-11-11: the first poster draft is done (`poster/poster.pptx` and `poster/poster.pdf`). The video comes
after the poster.

## The reference video

The user gave https://www.youtube.com/watch?v=Loi3ZcmfWIY as a style reference ("Project-Demo-Syed", 1:07).
It has music and a voiceover, and it shows no technical detail. Its arc has three parts:

1. Problem: AI services can be tampered with, for example by model poisoning, so people do not trust their predictions.
2. Solution: a blockchain gives AI services an immutable, tamper-proof, consensus-based record.
3. Benefit: people can rely on trusted prediction services.

Both of our pieces follow the same arc: problem, idea, proof, why it matters.

## The reference poster

The user added `poster.pptx` as the reference. It is one slide, 48 inches wide by 36 inches tall.

- Look: green theme (dark green title band and section headers on a light green background), with author headshots
  at the left and right of the title.
- Title: "Achieving Unanimous Consensus in Blockchain with Multi-Agent Deliberation".
- Challenges: no proper decision making in blockchain consensus, no prior work on AI agents within a blockchain,
  and a new kind of consensus that needs every node to agree (unanimous consensus).
- Problem Definition: a figure that shows applications (legal policy, theorem proving, government policy), agreement
  requirements, existing consensus (DPoS, PoA, PoW, PoS), and their limits (majority vote, no decision making,
  focus on fast finality).
- Solution 1: a deliberation framework based on deductive arguments. It has an argument graph and a chart of
  available moves against the number of disputes.
- Solution 2: multiple agents for decision making and unanimous consensus. It has charts of accuracy against
  deliberation rounds (GSM8K), LLM response time (13b and 70b), and block size against agents and turns.

The reference poster shows results and mechanisms in detail. The new poster gives less away. It keeps the
framing and the look, but it replaces most charts with one simple diagram and one real screenshot.

## Poster plan

The story is the one from the reference poster: blockchain consensus today votes or races, and it does not
reason. In this work, AI agents deliberate in turns. When every node holds the same result, the chain records the
decision.

Proposed layout, 48 inches wide by 36 inches tall, in the reference look:

1. Title band: the title, the authors, and the headshots, as in the reference.
2. The problem: existing consensus counts votes or finds the fastest node. It does not make reasoned decisions.
3. The idea: a simple diagram of three agents that pass turns around a ring, with their replies flowing into one
   block.
4. Proof: a real screenshot of the demo's sealed panel. It shows three matching hash fingerprints and the
   agents' final answers.
5. Why it matters: decisions that need agreement and an audit trail, for example policy, legal review, and
   theorem proving.
6. A QR code to the demo video, and contact details.

What the poster leaves out: the Nimiq base, the removal of mining, the turn mechanism, the prompts, the model
name, the timing numbers, and the detailed charts. The open questions below decide the final list.

How it gets built: an HTML page at the exact print size, exported to a vector PDF with the Chrome on
`ceng-l-dqbx564`. The screenshots come from the live UI at three times the screen resolution, so that they print
sharply. If the user wants to edit the poster in PowerPoint, a `.pptx` version is also possible.

## Poster draft 1

The user's decisions on 2026-11-11:

- `poster.pptx` is only a template. Claude can change it freely and remove old charts without asking.
- The author names, the university, and the lab name ("Network Security Labs") stay.
- The poster does not mention Nimiq or Llama.
- The size stays at 48 by 36 inches. There is no deadline pressure.

What draft 1 contains: the title band with both photos, the hook "Blockchains agree on data. We make them agree on
decisions.", and five panels. The panels are the problem, the idea (an agent ring and a sealed block), the proof
(a screenshot of the sealed block from the real model run on 2026-11-06), the live demo (counts and a chain of
blocks), and the uses (policy, legal review, theorem proving, shared AI decisions). All old charts are removed.

The files are in `poster/`:

- `build.js` builds `poster.pptx` from the images in `poster/assets/`.
- `poster.pdf` is the print version. LibreOffice exports it with Liberation Sans, which has the same widths as Arial.

To rebuild, install the packages in a folder outside the repo, then run the script:

```bash
cd /some/folder && npm i pptxgenjs react react-dom react-icons sharp
NODE_PATH=/some/folder/node_modules node poster/build.js
cd poster && soffice --headless --convert-to pdf poster.pptx
```

Known issue: the right photo in the template is only 95 by 119 pixels, so it prints blurry at 4 inches. A larger
photo goes in `poster/assets/headshot-right.png`.

A QR code to the video can go in the empty space under the proof caption when the video exists.

## Video plan

The video follows the reference at 60 to 90 seconds:

1. Hook, about 10 seconds: a question such as "Who checks what the AI agents decided?"
2. Idea, about 15 seconds: an animated version of the poster diagram.
3. Demo, about 40 seconds: a real recording of the UI. A problem is chosen, the nodes show their thinking state,
   and the replies arrive. The real run takes about 2 minutes, so the waiting parts are sped up. The block seals,
   and the three fingerprints match.
4. Close, about 10 seconds: a title card with the QR code or the conference name.

How it can be made: headless Chrome records the UI frames, the title cards are HTML, and ffmpeg joins them.
ffmpeg is not installed on `ceng-l-dqbx564`, but a copy can go in a user folder without admin rights. A real run
needs the GPU (about 41 GB free).

## Video decisions

The user's decisions on 2026-11-11:

- The video plays on a loop at the poster.
- It has a voiceover and burned-in captions. The captions alone must carry the story in a noisy hall.
- It is 60 seconds long.

Because it loops, the last card leads back into the first one, and no scene depends on the viewer seeing the start.
The demo part uses a real model run, not the fake LLM. It is recorded from the UI's replay of block 3, the real
run from 2026-11-06, so it needs no GPU. The video shows the replay banner or says in the caption that it is a
recorded run.

## Video script, draft 1

The script is about 110 words, which is a calm pace for 60 seconds. The captions use the same words.

| Time | Picture | Voiceover and caption |
|---|---|---|
| 0 to 8 s | Title card with the hook | "Blockchains are good at agreeing on data. But who agrees on decisions?" |
| 8 to 18 s | Icons for majority vote and leader election | "Today's consensus counts votes or picks a leader. Nobody reasons, and the minority is overruled." |
| 18 to 30 s | The agent ring from the poster, animated | "We let AI agents deliberate instead. Each agent runs on its own node, reads the others, and answers in turn." |
| 30 to 50 s | The real demo run, sped up | "Here, three agents solve a problem live. When the debate ends, one block seals the whole conversation, and every node holds the same hash." |
| 50 to 60 s | Closing card: title, names, lab, university | "Unanimous consensus, with every argument on record. Network Security Labs, University of North Texas." |

## Open questions

1. Video: who records the voiceover, the user or a synthetic voice made on this machine?
2. Video: should the demo scene show the replay banner, or hide it and say "recorded run" in the caption?

## Video build status (2026-11-11)

The user chose captions only, with no voiceover. The demo scene is the UI replay of block 3 without the banner,
and its caption says that it is a recorded run, sped up.

`video/scenes.html` draws the hook, problem, agent ring, and closing scenes. `video/build.js` records them and
the demo replay, then joins the frames with ffmpeg into `video/deliberation-demo.mp4`. Previews pass after the
layout fixes. The full render ran on 2026-11-11 (60 s, 1920 x 1080, 30 fps, 4.9 MB). To rebuild it, install `puppeteer-core react react-dom react-icons`
in a folder outside the repo, get an ffmpeg with libx264 (for example `pip install imageio-ffmpeg`), keep the
demo UI running, and run:

```bash
NODE_PATH=<folder>/node_modules FFMPEG=<ffmpeg binary> node video/build.js full
```
