// @UP: changing block class so that it does not have blockinterlink
class Block {
    /**
     * @param {BlockHeader} header
     * @param {BlockBody} [body]
     */
    constructor(header, body) {
        if (!(header instanceof BlockHeader)) throw new Error('Malformed header');
        if (body && !(body instanceof BlockBody)) throw new Error('Malformed body');

        /** @type {BlockHeader} */
        this._header = header;
        /** @type {BlockBody} */
        this._body = body;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {Block}
     */
    static unserialize(buf) {
        const header = BlockHeader.unserialize(buf);

        let body = undefined;
        const bodyPresent = buf.readUint8();
        if (bodyPresent) {
            body = BlockBody.unserialize(buf);
        }

        return new Block(header, body);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._header.serialize(buf);

        if (this._body) {
            buf.writeUint8(1);
            this._body.serialize(buf);
        } else {
            buf.writeUint8(0);
        }

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._header.serializedSize
            + /*bodyPresent*/ 1
            + (this._body ? this._body.serializedSize : 0);
    }

    /**
     * @param {Time} time
     * @returns {Promise.<boolean>}
     */
    async verify(time) {
        if (this._valid === undefined) {
            if (this.isLight() || this.body.transactions.length < 150 || !IWorker.areWorkersAsync) {
                // worker overhead doesn't pay off for small transaction numbers
                this._valid = await this._verify(time.now());
            } else {
                //@UP: TODO: This can be removed execution should never flow here
                // as txn.length cannot be >=150.
                const transactionValid = this.body.transactions.map(t => t._valid);
                const worker = await CryptoWorker.getInstanceAsync();
                const {valid, pow, bodyHash} = await worker.blockVerify(this.serialize(),
                    transactionValid, time.now(), GenesisConfig.GENESIS_HASH.serialize(), GenesisConfig.NETWORK_ID);
                this._valid = valid;
                this.header._pow = Hash.unserialize(new SerialBuffer(pow));
                this.body._hash = Hash.unserialize(new SerialBuffer(bodyHash));
            }
        }
        return this._valid;
    }

    /**
     * @param {number} timeNow
     * @returns {Promise.<boolean>}
     */
    async _verify(timeNow) {
        // Check that the timestamp is not too far into the future.
        if (this._header.timestamp * 1000 > timeNow + Block.TIMESTAMP_DRIFT_MAX * 1000) {
            Log.w(Block, 'Invalid block - timestamp too far in the future');
            return false;
        }

        // Check that the maximum block size is not exceeded.
        if (this.serializedSize > Policy.BLOCK_SIZE_MAX) {
            Log.w(Block, 'Invalid block - max block size exceeded');
            return false;
        }

        // XXX Verify the body only if it is present.
        if (this.isFull() && !this._verifyBody()) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @returns {boolean}
     * @private
     */
    _verifyBody() {
        // Check that the body is valid.
        if (!this._body.verify()) {
            return false;
        }

        // Check that bodyHash given in the header matches the actual body hash.
        const bodyHash = this._body.hash();
        if (!this._header.bodyHash.equals(bodyHash)) {
            Log.w(Block, 'Invalid block - body hash mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {Block} predecessor
     * @returns {Promise.<boolean>}
     */
    async isImmediateSuccessorOf(predecessor) {
        // Check the header.
        if (!this._header.isImmediateSuccessorOf(predecessor.header)) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {Block} predecessor
     * @returns {Promise.<boolean>}
     */
    async isSuccessorOf(predecessor) {
        // TODO Improve this! Lots of duplicate checks.
        return (await this.isImmediateSuccessorOf(predecessor));
    }

    /**
     * @returns {Block}
     */
    shallowCopy() {
        return new Block(this._header, this._body);
    }

    /**
     * @param {Block|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof Block
            && this._header.equals(o._header)
            && (this._body ? this._body.equals(o._body) : !o._body);
    }

    /**
     * @returns {boolean}
     */
    isLight() {
        return !this._body;
    }

    /**
     * @returns {boolean}
     */
    isFull() {
        return !!this._body;
    }

    /**
     * @returns {Block}
     */
    toLight() {
        return this.isLight() ? this : new Block(this._header, this._interlink);
    }

    /**
     * @param {BlockBody} body
     * @returns {Block}
     */
    toFull(body) {
        return this.isFull() ? this : new Block(this._header, body);
    }

    /**
     * @type {BlockHeader}
     */
    get header() {
        return this._header;
    }

    /**
     * @type {BlockBody}
     */
    get body() {
        if (this.isLight()) {
            throw new Error('Cannot access body of light block');
        }
        return this._body;
    }

    /**
     * @returns {number}
     */
    get version() {
        return this._header.version;
    }

    /**
     * @type {Hash}
     */
    get prevHash() {
        return this._header.prevHash;
    }

    /**
     * @type {Hash}
     */
    get bodyHash() {
        return this._header.bodyHash;
    }

    /**
     * @type {Hash}
     */
    get accountsHash() {
        return this._header.accountsHash;
    }

    /**
     * @type {number}
     */
    get nBits() {
        return this._header.nBits;
    }

    //@UP TODO: these can be removed later 
    /**
     * @type {BigNumber}
     */
    get target() {
        return this._header.target;
    }

    /**
     * @type {BigNumber}
     */
    get difficulty() {
        return this._header.difficulty;
    }

    /**
     * @type {number}
     */
    get height() {
        return this._header.height;
    }

    /**
     * @type {number}
     */
    get timestamp() {
        return this._header.timestamp;
    }

    /**
     * @type {number}
     */
    get nonce() {
        return this._header.nonce;
    }

    /**
     * @type {Address}
     */
    get minerAddr() {
        return this._body ? this._body.minerAddr : undefined;
    }

    /**
     * @type {?Array.<Transaction>}
     */
    get transactions() {
        return this._body ? this._body.transactions : undefined;
    }

    /**
     * @returns {?Uint8Array}
     */
    get extraData() {
        return this._body ? this._body.extraData : undefined;
    }

    /**
     * @returns {?Array.<PrunedAccount>}
     */
    get prunedAccounts() {
        return this._body ? this._body.prunedAccounts : undefined;
    }

    /**
     * @type {?number}
     */
    get transactionCount() {
        return this._body ? this._body.transactionCount : undefined;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {Hash}
     */
    hash(buf) {
        return this._header.hash(buf);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {Promise.<Hash>}
     */
    pow(buf) {
        return this._header.pow(buf);
    }

    /**
     * @param {Block|object|string} block
     */
    static fromAny(block) {
        if (block instanceof Block) return block;
        if (typeof block === 'object') return Block.fromPlain(block);
        if (typeof block === 'string') return Block.unserialize(BufferUtils.fromHex(block));
        throw new Error('Invalid block');
    }

    /**
     * @param {object} plain
     */
    static fromPlain(plain) {
        const header = new BlockHeader(
            Hash.fromAny(plain.prevHash),
            // Hash.fromAny(plain.interlinkHash),
            Hash.fromAny(plain.bodyHash),
            Hash.fromAny(plain.accountsHash),
            //plain.nBits,
            plain.height,
            plain.timestamp,
            //plain.nonce,
            plain.version
        );
        // const interlink = new BlockInterlink((plain.interlink.hashes || plain.interlink).map(h => Hash.fromAny(h)), Hash.fromAny(plain.prevHash));
        let body = null;
        if (plain.minerAddr && plain.extraData !== undefined && Array.isArray(plain.transactions) && Array.isArray(plain.prunedAccounts)) {
            body = new BlockBody(
                Address.fromAny(plain.minerAddr),
                plain.transactions.map(tx => Transaction.fromAny(tx)),
                BufferUtils.fromAny(plain.extraData),
                plain.prunedAccounts.map(pa => PrunedAccount.fromAny(pa))
            );
        }
        return new Block(header, body);
    }

    toString() {
        return `Block{height=${this.height},prev=${this.prevHash}}`;
    }

    toPlain() {
        const plain = {
            version: this.version,
            hash: this.hash().toPlain(),
            prevHash: this.prevHash.toPlain(),
            // interlinkHash: this.interlinkHash.toPlain(),
            bodyHash: this.bodyHash.toPlain(),
            accountsHash: this.accountsHash.toPlain(),
            nBits: this.nBits,
            difficulty: this.difficulty.toString(),
            height: this.height,
            timestamp: this.timestamp,
            nonce: this.nonce,
            // interlink: this.interlink.hashes.map(h => h.toPlain()),
        };
        if (this.isFull()) {
            plain.minerAddr = this.minerAddr.toPlain();
            plain.transactions = this.transactions.map(tx => tx.toPlain());
            plain.extraData = BufferUtils.toHex(this.extraData);
            plain.prunedAccounts = this.prunedAccounts.map(pa => pa.toPlain());
        }
        return plain;
    }
}

Block.TIMESTAMP_DRIFT_MAX = 600 /* seconds */; // 10 minutes
Class.register(Block);