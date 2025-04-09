class BlockHeader {
    /**
     * @param {Hash} prevHash
     * @param {Hash} bodyHash
     * @param {Hash} accountsHash
     * @param {number} height
     * @param {number} timestamp
     * @param {number} version
     */
    constructor(prevHash, bodyHash, accountsHash, height, timestamp, version = BlockHeader.CURRENT_VERSION) {
        if (!NumberUtils.isUint16(version)) throw new Error('Malformed version');
        if (!Hash.isHash(prevHash)) throw new Error('Malformed prevHash');
        if (!Hash.isHash(bodyHash)) throw new Error('Malformed bodyHash');
        if (!Hash.isHash(accountsHash)) throw new Error('Malformed accountsHash');
        if (!NumberUtils.isUint32(height)) throw new Error('Invalid height');
        if (!NumberUtils.isUint32(timestamp)) throw new Error('Malformed timestamp');

        /** @type {number} */
        this._version = version;
        /** @type {Hash} */
        this._prevHash = prevHash;
        /** @type {Hash} */
        this._bodyHash = bodyHash;
        /** @type {Hash} */
        this._accountsHash = accountsHash;
        /** @type {number} */
        this._height = height;
        /** @type {number} */
        this._timestamp = timestamp;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockHeader}
     */
    static unserialize(buf) {
        const version = buf.readUint16();
        if (!BlockHeader.SUPPORTED_VERSIONS.includes(version)) throw new Error(`Unsupported block version ${version}`);
        const prevHash = Hash.unserialize(buf);
        const bodyHash = Hash.unserialize(buf);
        const accountsHash = Hash.unserialize(buf);
        const height = buf.readUint32();
        const timestamp = buf.readUint32();
        return new BlockHeader(prevHash, bodyHash, accountsHash, height, timestamp, version);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._version);
        this._prevHash.serialize(buf);
        this._bodyHash.serialize(buf);
        this._accountsHash.serialize(buf);
        buf.writeUint32(this._height);
        buf.writeUint32(this._timestamp);
        return buf;
    }

    //@UP: Updated the size
    // 2 + 32 * 2 + 4 + 4 = 74
    /** @type {number} */
    get serializedSize() {
        return /*version*/ 2
            + this._prevHash.serializedSize
            + this._bodyHash.serializedSize
            + this._accountsHash.serializedSize
            + /*height*/ 4
            + /*timestamp*/ 4
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {Promise.<boolean>}
     */
    async verifyProofOfWork(buf) {
        const pow = await this.pow(buf);
        return BlockUtils.isProofOfWork(pow, this.target);
    }

    /**
     * @param {BlockHeader} prevHeader
     * @returns {boolean}
     */
    isImmediateSuccessorOf(prevHeader) {
        // Check that the height is one higher than the previous height.
        if (this.height !== prevHeader.height + 1) {
            return false;
        }

        // Check that the timestamp is greater or equal to the predecessor's timestamp.
        if (this.timestamp < prevHeader.timestamp) {
            return false;
        }

        // Check that the hash of the predecessor block equals prevHash.
        const prevHash = prevHeader.hash();
        if (!this.prevHash.equals(prevHash)) {
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {Hash}
     */
    hash(buf) {
        this._hash = this._hash || Hash.light(this.serialize(buf));
        return this._hash;
    }
    
    /**
     * @param {SerialBuffer} [buf]
     * @return {Promise.<Hash>}
     */
    async pow(buf) {
        this._pow = this._pow || await Hash.hard(this.serialize(buf));
        return this._pow;
    }

    /**
     * @param {BlockHeader|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof BlockHeader
            && this._prevHash.equals(o.prevHash)
            && this._bodyHash.equals(o.bodyHash)
            && this._accountsHash.equals(o.accountsHash)
            && this._height === o.height
            && this._timestamp === o.timestamp
    }

    /**
     * @returns {string}
     */
    toString() {
        return 'BlockHeader{'
            + `prevHash=${this._prevHash}, `
            + `bodyHash=${this._bodyHash}, `
            + `accountsHash=${this._accountsHash}, `
            + `height=${this._height}, `
            + `timestamp=${this._timestamp}, `
            + '}';
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {Hash} */
    get prevHash() {
        return this._prevHash;
    }

    /** @type {Hash} */
    get bodyHash() {
        return this._bodyHash;
    }

    /** @type {Hash} */
    get accountsHash() {
        return this._accountsHash;
    }

    //@UP: TODO: can remove target and difficulty
    /** @type {BigNumber} */
    get target() {
        return BlockUtils.compactToTarget(this._nBits);
    }

    /** @type {BigNumber} */
    get difficulty() {
        return BlockUtils.compactToDifficulty(this._nBits);
    }

    /** @type {number} */
    get height() {
        return this._height;
    }

    /** @type {number} */
    get timestamp() {
        return this._timestamp;
    }

    // XXX The miner changes the nonce of an existing BlockHeader during the
    // mining process.
    /** @type {number} */
    set nonce(n) {
        this._nonce = n;
        this._hash = null;
        this._pow = null;
    }
}
BlockHeader.Version = {
    V1: 1
};
BlockHeader.CURRENT_VERSION = BlockHeader.Version.V1;
BlockHeader.SUPPORTED_VERSIONS = [
    BlockHeader.Version.V1
];
//@UP TODO: need to change this to 74
BlockHeader.SERIALIZED_SIZE = 146;
Class.register(BlockHeader);