# Fail-safe server setup for the deliberation demo

This file gives a new Claude session the context to set up and test a backup copy of the demo on a second
server. The main demo runs on `ceng-l-dqbx564.unt.ad.unt.edu` (called "the main server" below). The event is on
2026-11-18. Read `handoff/memory.md` too. It has the full project history and rules.

## What the project is

Three blockchain nodes run on one machine. A user picks a problem in a web UI. Three AI agents (one per node)
answer the problem, read each other's answers, and can change their minds. When all agents finish, the nodes seal
the whole discussion into one block, and every node keeps the same copy.

The parts and their ports, all on 127.0.0.1:

| Part | Code | Port |
|---|---|---|
| Model server (Llama 3.1 70B on the GPU) | `LLM-Deliberation/Model/ModelServer.py` | 5001 |
| Deliberation server (builds the prompts) | `LLM-Deliberation/Deliberation/DefinitiveDeliberationServer.py` | 5000 |
| Nodes 1 to 3 (P2P and JSON-RPC) | `clients/nodejs/index.js` in this repo | 8501-8503, 8601-8603 |
| Demo UI | `demo-ui/server.js` | 8700 |

The launcher `./demo` starts all of them. Run data (chain, keys, logs, block history) is in `.demo/`, which git
ignores.

## Rules for the Claude session

- Never run `git commit` or `git push`. The user makes all commits.
- Never run `./demo reset`. It deletes the chain and the recorded deliberations.
- Always use `--nodes 3`. A different node count makes `./demo start` delete the chain.
- `Model/ModelEngine.py` contains an old Hugging Face token. Do not print it, copy it, or mention it.
- Before you change an existing file, show the diff and wait for the user to approve it.

## First task: audit this server and list what to install

Do not install anything yet. Inspect this server and give the user one list in two parts.

1. Items that need sudo. The user sends this part to the administrator. Give the exact commands for this OS.
2. Items that the user can install in the home directory without sudo, with the commands.

Check these items, and report what is present, what is missing, and what has the wrong version:

- OS and version (`/etc/os-release`), and the package manager.
- C build tools: gcc, g++, make. `yarn` compiles a native addon and `node-lmdb` with `node-gyp`.
- A Python 3.10 or 3.11 with `distutils`, for `node-gyp`. Python 3.12 and later have no `distutils`, and the
  build fails with `ModuleNotFoundError: No module named 'distutils'`.
- git, curl, rsync, and SSH access to GitHub (`ssh -T git@github.com`).
- Node 20.19.0, nvm and yarn 1.22. nvm installs in the home directory, and yarn installs with npm, so neither
  needs sudo.
- conda or Miniconda. It installs in the home directory without sudo.
- GPU: `nvidia-smi` model, total and free memory, and the driver version. The real model needs one GPU with
  41 GB free and a driver that supports CUDA 12.4 (driver 550 or later). Without that, plan for `--fake-llm`.
- Free disk space in the home directory. The model cache needs about 135 GB.
- Whether ports 5000, 5001, 8501-8503, 8601-8603 and 8700 are free.

For reference, the main server runs Ubuntu 22.04 with gcc 11.4, Python 3.10.12 in `/usr/bin`, yarn 1.22.22,
an RTX 6000 Ada (48 GB) and driver 595.71.05.

## Hardware needs

- Real model: one GPU with at least 41 GB free. If there is less, the launcher stops. It checks the free memory
  with `nvidia-smi`. The model loads in about 55 seconds and uses 39 to 41 GB.
- Disk: about 135 GB for the model cache plus about 2 GB for the code and `node_modules`.
- If the server has no such GPU, the demo still runs with `--fake-llm` (scripted answers, no GPU), and the
  replays of recorded blocks still work.

## Setup steps (no sudo)

1. Clone both repos next to each other. The launcher looks for `LLM-Deliberation` in the parent directory of
   this repo. If it is somewhere else, set `DEMO_LLM_DIR`.
   ```bash
   mkdir -p ~/ap1923 && cd ~/ap1923
   git clone git@github.com:apurbapokharel/blockchain-core-js.git && (cd blockchain-core-js && git checkout demo)
   git clone git@github.com:apurbapokharel/LLM-Deliberation.git && (cd LLM-Deliberation && git checkout b69ec5f)
   ```
2. Install Node 20.19.0 with nvm. The launcher requires exactly this version at
   `~/.nvm/versions/node/v20.19.0/bin/node`. If it is somewhere else, set `DEMO_NODE`.
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   nvm install 20.19.0 && npm install -g yarn@1.22.22
   ```
3. Build the nodes. Point `node-gyp` at Python 3.10.
   ```bash
   cd ~/ap1923/blockchain-core-js
   PYTHON=/usr/bin/python3.10 npm_config_python=/usr/bin/python3.10 yarn && yarn build
   ```
   Babel prints parse messages about `platform/browser`. If the build exits with code 0, these messages are normal. The
   build must create `build/Release/nimiq_node_native.node`.
4. If the server has no suitable GPU, skip this step. Create the Python env. The launcher expects
   `~/.conda/envs/deli/bin/python`. If it is somewhere else, set `DEMO_PYTHON`. These are the versions that
   work on the main server:
   ```bash
   conda create -y -n deli python=3.13
   ~/.conda/envs/deli/bin/pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124
   ~/.conda/envs/deli/bin/pip install transformers==5.9.0 accelerate==1.6.0 bitsandbytes==0.49.2 \
       flask==3.1.0 requests==2.32.3 pynvml==12.0.0 nvidia-ml-py matplotlib numpy==1.26.4 \
       huggingface_hub==1.16.1 safetensors
   ```
5. If the server has no suitable GPU, skip this step. Copy the model cache from the main server. The model is
   gated and the token in the code is no longer valid, so a fresh download fails. The copy is 132 GB, so start
   it early.
   ```bash
   mkdir -p ~/.cache/huggingface/hub
   rsync -a --info=progress2 ap1923@ceng-l-dqbx564.unt.ad.unt.edu:.cache/huggingface/hub/models--meta-llama--Llama-3.1-70B-Instruct ~/.cache/huggingface/hub/
   ```
6. Copy the recorded deliberations, so that the replays work. Do not copy PID or log files.
   ```bash
   rsync -a --exclude='*.pid' --exclude='*.log' ap1923@ceng-l-dqbx564.unt.ad.unt.edu:/home/UNT/ap1923/ap1923/blockchain-core-js/.demo/ ~/ap1923/blockchain-core-js/.demo/
   ```
   The chain holds blocks 2 to 6. Block 4 (dengue diagnosis) and block 6 (hatchet legal case) are good replays.
   In block 5 (cabin legal case), the agents agreed on a wrong answer. Blocks 2 and 3 are an old math problem.
   Any run on the main server after this copy is not on the backup.

## Tests to run, in order

1. Build check: `ls build/Release/nimiq_node_native.node` exists, and `node -v` with the nvm Node prints
   `v20.19.0`.
2. Fake start: `./demo start --nodes 3 --fake-llm`. The launcher must print "consensus established" and the UI
   line. Then make sure that `curl -s localhost:8700/api/blocks` lists blocks 2 to 6.
3. UI from the laptop: `ssh -L 8700:127.0.0.1:8700 <user>@<backup host>`, then open http://localhost:8700. The
   landing page must show the medical and legal cases. Replay block 4 and block 6.
4. Fake run: start the dengue case in the UI. It must seal a new block on all 3 nodes. This adds a block that
   was written by the fake LLM.
5. Only with a suitable GPU: run `./demo stop`, then `./demo start --nodes 3`. The model must load (about one
   minute, log in `.demo/model.log`). Then run the dengue case. All replies on the main server chose B (dengue).
6. If the user asks, stop the GPU model after the test with `./demo stop`. To keep the nodes and the UI up without the
   model, stop only the PID in `.demo/model.pid`, after you make sure that its command line contains
   `ModelServer.py`.

## Known limits

- Use rounds 2. The UI accepts up to 5 rounds, but the code defines only round 1 (independent answers) and round
  2 (discussion, repeated "turns" times). In round 3, the agents do not see each other's replies.
- `video/build.js` still expects the old UI layout.
- If the backup host is on the UNT network, an off-campus laptop needs the UNT VPN for the `ssh -L` tunnel.
