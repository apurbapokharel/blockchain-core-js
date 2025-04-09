class BlockProducer {

    constructor(blockchain, accounts, mempool, time) {
        /** @type {BaseChain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Time} */
        this._time = time;
    }


    /**
     * @param {Address} address
     * @param {Uint8Array} [extraData]
     * @return {Promise.<Block>}
     */
    async getNextBlock(address, extraData = new Uint8Array(0)) {
        // const nextTarget = await this._blockchain.getNextTarget();
        // const interlink = await this._getNextInterlink(nextTarget);
        const body = await this._getNextBody(address, extraData);
        const header = await this._getNextHeader(body);
        // if (!(await this._blockchain.getNextTarget()).equals(nextTarget)) return this.getNextBlock(address, extraData);
        return new Block(header, body);
    }

    /**
     * @param {BlockBody} body
     * @return {Promise.<BlockHeader>}
     * @package
     */
    async _getNextHeader(body) {
        const prevHash = this._blockchain.headHash;
        const height = this._blockchain.height + 1;

        // Compute next accountsHash.
        const accounts = await this._accounts.transaction();
        let accountsHash;
        try {
            await accounts.commitBlockBody(body, height, this._blockchain.transactionCache);
            accountsHash = await accounts.hash();
        } catch (e) {
            throw new Error(`Invalid block body: ${e.message}`);
        } finally {
            await accounts.abort();
        }

        const bodyHash = body.hash();
        const timestamp = this._getNextTimestamp();
        return new BlockHeader(prevHash, bodyHash, accountsHash, height, timestamp);
    }

    /**
     * @param {Address} address
     * @param {Uint8Array} extraData
     * @return {BlockBody}
     * @package
     */
    //@UP FIXME: need to fix the size
    async _getNextBody(address, extraData) {
        const maxSize = Policy.BLOCK_SIZE_MAX
            - BlockHeader.SERIALIZED_SIZE
            - BlockBody.getMetadataSize(extraData);
        const transactions = await this._mempool.getTransactionsForBlock(maxSize);
        const messages = await this._mempool.getMessagesForBlock(maxSize);
        let messageString = "";
        for (const msg of messages){
            messageString += msg._senderPubKey.toHex() + " : " + msg._decodedMessage + "\n";
            // console.log("message sent from mempool", msg._decodedMessage);
        }
        const byteArray = BufferUtils.fromAscii(messageString);

        const prunedAccounts = await this._accounts.gatherToBePrunedAccounts(transactions, this._blockchain.height + 1, this._blockchain.transactionCache);
        return new BlockBody(address, transactions, byteArray, prunedAccounts);
    }
    
    /**
     * @return {number}
     * @package
     */
    _getNextTimestamp() {
        const now = Math.floor(this._time.now() / 1000);
        return Math.max(now, this._blockchain.head.timestamp + 1);
    }

}

Class.register(BlockProducer);