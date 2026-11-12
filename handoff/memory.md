# Handoff: deliberation blockchain demo

Read this whole file before doing anything. It replaces the Claude Code session and memory from the
previous workstation (`ceng-l-h226nd4`). Written 2026-11-04.

## Goal
The user published research on this repo: a Nimiq core-js fork, with PoW removed, that stores multi-agent
LLM deliberation in blocks (paper: "Achieving Unanimous Consensus Through Multi-Agent Deliberation").
They have a blockchain event around **2026-11-21** and want visitors to understand it through a UI, not CLI
commands.

Demo: 2-4 nodes on one GPU machine. A visitor picks a problem from a pool and presses Start. The nodes take
turns, with a visible "thinking" state and live replies. Finalize seals everything into one block, and the UI
proves that all nodes hold the same block hash. Chain state resets between deliberations. One LLM serves all
nodes. The user presents from a laptop over VPN and SSH, and will record a backup run.

## Rules from the user (follow these)
- **Never run `git commit`.** The user makes all commits. Leave changes in the working tree and say what is
  uncommitted.
- **PoC good enough:** small fixes only, skip big ones, accept known defects, reset the chain between runs.
- **Ask rather than over-investigate.** The user knows this code well and interrupted long edge-case testing.
  Ask in plain text in chat. They interrupted AskUserQuestion dialogs.
- **Read `dist/node.js`** to understand the node, since it is the combined code that runs. Put changes in
  `src/` too, because `yarn` regenerates dist from src.
- Use `deli1`-based code (the `demo` branch), not `main`. Only `deli1` has the LLM integration.
- `DefinitiveDeliberationServer.py` is the chosen deliberation server.
- The Hugging Face token hardcoded in `Model/ModelEngine.py` is deprecated. The user knows, so don't raise it.
  See setup below for what that means when downloading the model.

## Current state
- Timeline step 1 is **done**: a real deliberation ran end to end on the patched code.
- Branch `demo` is based on `origin/deli1` at `60fb0fd`.
- Miner patch in `src/main/generic/miner/Miner.js` and `dist/node.js`: a `_loopEnabled` flag so that mining
  stays off until asked. With mining off on all nodes, one `mint` RPC seals all messages into one block.
- The launcher, the `deliberationState` RPC and the UI exist in the working tree on `ceng-l-dqbx564`.
- The fake LLM tests pass on 3 nodes. On 2026-11-06 the real model ran problem 1 (3 nodes, rounds 2, turns 2)
  through the UI: 9 replies in 2 minutes, one block with the same hash on all nodes, all answers $5, no log errors.
- `Mempool.pushMessage` now clears `_messagesByRounds` at init, so a second deliberation needs no restart.
- The user removed problem 8 from the pool. Problems 6 and 9 stay out because the model fails on them.
- Replay (2026-11-11): the UI can play a stored block again as if it were live, for the presentation loop. It
  needs no GPU and changes nothing on the nodes. A sticky banner says that it is a replay and names the block.
  "Replay recorded runs on a loop" in the picker cycles through the blocks from real AI runs. The Blocks tab has
  "Replay this deliberation" for one block. Only block 3 (2026-11-06) is from the real model. Block 2 is from the
  fake LLM.
- UI rework (2026-11-12, after the professor's feedback): the landing page has a hero with the problem and the
  benefits, and cases from `~/ap1923/betterDeliberation`: 4 medical diagnoses (symptom dataset: dengue, tuberculosis,
  heart attack, hyperthyroidism) and 4 legal cases (MMLU-Pro law, each cut to 4 options). Only 3 math problems stay,
  as small chips. Store clearance stays because block 3, the real recorded run, uses it. A run shows a graph of the agents with each agent's current answer, then a one-line timeline,
  then the full replies. Multiple-choice answers come from "Final answer: <letter>". Neither case has run on the
  real model yet. `video/build.js` still expects the old card layout, so the video needs changes before a rebuild.
- Each sealed block's entry in `.demo/blocks.json` now stores `llm` ("real" or "fake") and `replyTimes` (ms after
  the start). Replays use the recorded gaps, kept between 2 and 12 s. Older blocks without times get a gap that
  grows with the reply length.

### Test result (one run: 3 nodes, star layout)
Problem: "If a/b=3/4 and 8a+5b=22 and a+c = 12 ,then find the value of c." Rounds "2", turns "1", which gives
6 messages.
- Consensus in about 2 s. Init reached all nodes in 0.8 s.
- About 2 min 20 s for all 6 replies. Each reply took about 5-40 s, and gossip about 1-2 s per reply.
- One `mint` gave identical block hash on all 3 nodes, 6 messages, 5285 bytes, mempools empty. No extra blocks
  appeared while idle. No exceptions.
- 5 of 6 replies stated the right answer (10.5 or 21/2). One said only that the answer "remains the same".

## Running the demo
```bash
./demo start --nodes 3              # real model; needs about 41 GB of free GPU memory
./demo start --nodes 3 --fake-llm   # no GPU; uses demo-ui/fake-llm.js on port 5000
./demo restart-nodes                # keeps the chain
./demo restart-ui                   # reloads demo-ui/server.js after a UI change
./demo reset                        # deletes the chain and the block history
./demo stop [--keep-llm]
```
The UI is on port 8700 and binds to 127.0.0.1. From the laptop, use `ssh -L 8700:127.0.0.1:8700 <user>@<host>`.
Files: `demo`, `demo-ui/server.js`, `demo-ui/problems.json`, `demo-ui/public/`. Run data is in `.demo/`, which is
gitignored. The block history keeps the problem text in `.demo/blocks.json`, keyed by block hash.

To rebuild on `ceng-l-dqbx564`, use the system Python 3.10, because `node-gyp` needs `distutils`:
`PYTHON=/usr/bin/python3 npm_config_python=/usr/bin/python3 yarn && yarn build`.

## Remaining work, in order
1. **More real model runs** on the other pool problems, to check answer extraction and header display.
2. **Rehearsal and recorded backup**, about days 11-14 (2026-11-15 to 2026-11-18). The replay loop is the backup.
3. **Poster and video**: see `videoposter.md`.

UI requirements found during the test:
- `startDeliberation` blocks until the first LLM reply, so call it in the background or with a long timeout.
- Replies contain Markdown headers and LaTeX such as `$\boxed{21/2}$`. Render or clean them.
- Nothing checks agreement between nodes, and the same answer appears as both `10.5` and `21/2`. Extract each
  final answer and show them side by side, marking unclear ones as unclear.

## Decisions from the user
- `LLM-Deliberation` is next to this repo, in `~/ap1923/LLM-Deliberation`, and the launcher uses the `deli` env.
- The user operates the UI. The default is rounds "2" and turns "1", and the user can edit these and the problem.
- A block seals automatically when every node reports `isEnd` and all `messageCount` values match and are stable.
- The chain now stays between deliberations, and a Blocks view shows past blocks and their deliberations.
  This replaces the reset between runs in the Goal section. `./demo reset` is still the full wipe.
- The correct answer appears after sealing, and it does not appear for an edited problem.

## Setup on a new machine
Needs: about 40 GB of GPU memory, about 132 GB of disk for the model cache as it stood here. The previous machine
had 2x H100 NVL. It had no Docker, Podman, Apptainer or passwordless sudo, so the plan was a launcher script
rather than containers.

- **Node 20.19.0 exactly.** Newer versions were not used. The previous system Node was v24, so a separate copy
  of Node 20 was used. `yarn` builds `dist/node.js` and the native addon `build/Release/nimiq_node_native.node`.
  `axios` must be present. It was installed by hand in the test checkout, and `yarn.lock` is gitignored.
- **LLM code:** https://github.com/apurbapokharel/LLM-Deliberation at `b69ec5f`. There is no requirements file.
- **Python:** the working env was Python 3.13.9, torch 2.6.0, transformers 5.9.0, accelerate 1.6.0,
  plus bitsandbytes, flask, pynvml, matplotlib, requests.
- **Model:** `meta-llama/Llama-3.1-70B-Instruct`, loaded in about 55 s using 39-41 GB on GPU 0. It is a gated
  model and `Model/ModelEngine.py` passes the deprecated token, so a fresh download will fail. Either copy
  `~/.cache/huggingface/hub/models--meta-llama--Llama-3.1-70B-Instruct` from the old machine, or use a new
  token in an environment variable. Check that the account still has access to the model.

Start the LLM (model first, then wait for it to load):
```bash
cd LLM-Deliberation/Model && HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 nohup python ModelServer.py &   # port 5001
cd LLM-Deliberation/Deliberation && python DefinitiveDeliberationServer.py                            # port 5000
```
Mempool calls `http://127.0.0.1:5000/init|round1|round2` (hardcoded) when it is a node's turn.

## How the nodes run
Each node needs its own working directory (holds peer-key, wallet, chain data) plus its own P2P and RPC ports. All
nodes can share one checkout. Start node 1 first, then the others. Run from the node dir:
`node <repo>/clients/nodejs/index.js --config=node.conf`
```
{ host: "my.domain", port: 850N, protocol: "ws", network: "dev", type: "full",
  rpcServer: { enabled: "yes", port: 860N }, miner: { enabled: "no", threads: 1 }, log: { level: "info" },
  constantOverrides: { "BaseConsensusAgent.TRANSACTION_RELAY_INTERVAL": 700 },
  seedPeers: [ {host:'127.0.0.1',port:8501,publicKey:'<node 1 public key>',protocol:'ws'} ] }  // node 1: []
```
- `host: "localhost"` is rejected ("PeerAddress not globally reachable"), so keep `my.domain`.
- The relay override is what makes gossip fast. Without it gossip is much slower.
- Node 1's public key changes when its `peer-key` file is created, so read it per machine.
- `sample.conf` is gone on deli1, although the README still points to it.

Flow, all over JSON-RPC on one node after all nodes connect (bound to 127.0.0.1 unless `allowip` is set, CORS via
`corsdomain`):
1. Poll `consensus` for "established" and `peerCount`.
2. `initDeliberation(nodeAddress, {problem, rounds:"2", turns:"1"})`. Wait until it reaches every node (log line
   "Init deli called"). Starting before that caused a `reading '0'` crash earlier.
3. `startDeliberation` on the same node.
4. Poll `messageCount` and `deliberationState` on all nodes until `isEnd` is true and the counts match. A fake LLM
   test with 3 nodes, rounds "2" and turns "2" gave 9 messages.
5. `mint` once. Check `getBlockByNumber` on each node. Messages are stored in `extraData` as hex of
   `"<pubkeyHex> : <text>\n"`.

Reset: stop the nodes, delete each `*-consensus` dir and log, restart.

## Scripts in `handoff/scripts/`
These are throwaway test scripts, copied for reference, and they will not run unchanged. `run_real.sh` expects a
scratch layout (`$1/deli`, `$1/cluster/n1..3`, `$1/pylibs`, `$1/node-v20.19.0-linux-x64`, `$1/llmrepo`, `$1/llmrun`)
and a hardcoded node 1 key. Use them as a starting point for the launcher.
- `run_real.sh` full test run; `probe5.py` drives it over RPC; `watch.py` polls message counts;
  `seal.py` mints and checks the block; `stop_all.sh` stops everything.
- Avoid `pkill -f` with a pattern that also appears in the calling shell's arguments: it kills its own parent.
  Use `[b]racket` patterns from a script file. Nodes can survive SIGTERM, so use `pkill -9` and wait for ports.

## Known issues, accepted for the PoC
- Forks never resolve (missing totalDifficulty, dist 24244 and 27570). Each block clears the whole message pool
  (dist 20470). Messages are unsigned.
- `/round2` in Mempool has an unbounded `while(true)` retry on empty LLM replies, which would hang a demo.
- Emoji is corrupted by `fromAscii` (dist 18596). `get.deliberations` splits on `.` (`clients/nodejs/remote.js:504`).
- Participants come from known addresses, so an offline seed may become a participant.
- `remote.js` was never successfully used for `get.deliberations`, since the flags used in testing were wrong.
