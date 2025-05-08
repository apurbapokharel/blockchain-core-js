class InitMessage extends Message{
    /**
     * @param {DeliberationInit} message
     */
    constructor(message) {
        super(Message.Type.INITMSG);
        /** @type {DeliberationInit} */
        this._message = message;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {InitMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const message = DeliberationInit.unserialize(buf);
        return new InitMessage(message);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._message.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + this._message.serializedSize;
        return size;
    }

    /** @type {DeliberationInit} */
    get message() {
        return this._message;
    }

    toString() {
        return `DeliberationInit{hash=${this._message.hash()}}`;
    }
}
Class.register(InitMessage);