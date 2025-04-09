class PingMessage extends Message {
    /**
     * @param {number} nonce
     */
    constructor(nonce) {
        super(Message.Type.PING);
        if (!NumberUtils.isUint32(nonce)) throw new Error('Malformed nonce');
        /** @type {number} */
        this._nonce = nonce;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PingMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PingMessage(nonce);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*nonce*/ 4;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    toString() {
        return `PingMessage{nonce=${this._nonce}}`;
    }
}
Class.register(PingMessage);

class PingMessage2 extends Message {
    /**
     * @param {number} nonce
     */
    constructor(nonce) {
        super(Message.Type.PING2);
        if (!NumberUtils.isUint32(nonce)) throw new Error('Malformed nonce');
        /** @type {number} */
        this._nonce = nonce;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PingMessage2}
     */
    static unserialize(buf) {
        console.log("unserialize called");
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PingMessage2(nonce);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        super._setChecksum(buf);
        console.log("serialize called", buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*nonce*/ 4;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    toString() {
        return `PingMessage2{nonce=${this._nonce}}`;
    }
}
Class.register(PingMessage2);

class PingMessage3 extends Message {
    /**
     * @param {Uint32Array} nonce
     */
    constructor(nonce) {
        //for now using a staic data
        nonce = new Uint32Array([10, 20, 30, 40]);
        super(Message.Type.PING3);
        if (!NumberUtils.isUint32Array(nonce)) throw new Error('Malformed Uint32Array');
        /** @type {number} */
        this._nonce = nonce;
        this._length = nonce.length;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PingMessage}
     */
    static unserialize(buf) {
        console.log("unserialize called");
        Message.unserialize(buf);
        const length = buf.readUint32();
        // Initialize the Uint32Array based on the length read from the buffer.
        const uint32Array = new Uint32Array(length);
        // Read each value from the buffer and store it in the Uint32Array.
        for (let i = 0; i < length; i++) {
            uint32Array[i] = buf.readUint32();
        }
        return new PingMessage3(uint32Array);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        // console.log("serialize called");
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._length);
        for (let i = 0; i < this._length; i++) {
            buf.writeUint32(this._nonce[i]);
        }
        super._setChecksum(buf);
        // console.log("serialized buff", buf)
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*length*/ 4
            + /*array*/ 4*this._length;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    toString() {
        return `PingMessage3{nonce=${this._nonce}}`;
    }
}
Class.register(PingMessage3);