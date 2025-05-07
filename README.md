# This branch has the basic send message feature and no integration with LLM.
# Deli1 has the LLM integration. 

# For details about the original repo please refer to NIMIQ.md file in this repo.
## Please note that as of Jan 25, 2025 core-js has been archived and nimiq moved to a rust based PoS implementation my work on core-js started from September 2023.

# Notice
This is a Proof of concept implementaion and is far from being a production ready implementation. Heaps of work is necessary to be used in production. Search for tag @UP to see the comments, notes, TODO, FIXME I've left for readers and potential forkers. Will try and write a medium article that explain all of the work I did, my approach, the way I solved it but make no gurantee.

# Prereqs
1. Install [Node.js](https://nodejs.org) >= v16.20.2.
2. On Ubuntu and Debian, install `git` and `build-essential`: `sudo apt-get install -y git build-essential`.
    - On other Linux systems, install `git`, `python3`, `make`, `gcc` and `gcc-c++`.
    - For MacOS or Windows, [check here for git](https://git-scm.com/downloads) and [here for compilation tools](https://github.com/nodejs/node-gyp#on-mac-os-x).
3. Install `yarn` globally: `sudo npm install -g yarn`.
4. Install `gulp` globally:  `yarn global add gulp`.
5. Clone this repository.

### Ensure that node version is 20.19.0 and npm version is 10.8.2 (Use nvm install 20.19.0 and nvm use 20.19.0). I used a newer version of node 23.6.1 and yarn build did not work.
### GNU Make - 4.3
### GCC - 11.4.0
### G++ - 11.4.0

# Steps to run blockchain node
1. Build the project: `cd core-js && yarn && yarn build`.
2. This will build a file node.js inside the dist folder, which will have all the code from source.
3. `cd clients/nodejs` and `node index.js --config=sample.conf`
4. This will spin up a blockchain on port specified inside sample.conf and will use code from dist/node.js

# Steps to send deliberation messages manually

1. Once the node is running, in another terminal instance `node remote.js send.message "your message"`
2. Play around with different nodes and send message in the same way
3. To check the total number of messages in order to verify consistency `node remote.js message.count`
4. To finalize the deliberation and mine the block with the deliberations stored in the block `node remote.js mining.enabled true`
