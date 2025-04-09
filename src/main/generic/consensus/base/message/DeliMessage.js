class DeliMessage extends Message{
    /**
     * @param {DeliberationMessage} message
     */
    constructor(message) {
        super(Message.Type.MSG);
        /** @type {TransacDeliberationMessagetion} */
        this._message = message;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {DeliMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const message = DeliberationMessage.unserialize(buf);
        return new DeliMessage(message);
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

    /** @type {DeliberationMessage} */
    get message() {
        return this._message;
    }

    toString() {
        return `DeliMessage{hash=${this._message.hash()}}`;
    }
}
Class.register(DeliMessage)