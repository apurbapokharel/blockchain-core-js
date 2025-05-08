// @UP: Notes for adding new messages
// Deliberation Message will be converted to Delimessage
// Then the class DeliMessage needs to be included in the following places as well.
// 1. Class MessageFactory.classes, 2. Class PeerChannel.event, 3. Class Message.Type
class DeliberationMessage {
  
    /**
     * @param {String} message
     * @param {PublicKey} senderPubKey
     * @param {Uint32} timeStamp
     */
    constructor(message, senderPubKey, timeStamp){
        this._decodedMessage = message
        this._senderPubKey = senderPubKey;
        this._timestamp = timeStamp;
    }

    encodeMessage(){
        let encoder = new TextEncoder();
        this._encodedMessage = encoder.encode(this._decodedMessage);
        this._length = this._encodedMessage.length;
    }

    hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || Hash.light(this.serialize());
        return this._hash;
    }

    static unserialize(buf) {
        const senderPubKey = PublicKey.unserialize(buf);
        const timeStamp = buf.readUint32();
        const length = buf.readUint32();
        const uint8Array = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            uint8Array[i] = buf.readUint8();
        }
        let decoder = new TextDecoder();
        let decodedMessage = decoder.decode(uint8Array);
        return new DeliberationMessage(decodedMessage, senderPubKey, timeStamp);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._senderPubKey.serialize(buf);
        buf.writeUint32(this._timestamp);
        buf.writeUint32(this._length);
        for (let i = 0; i < this._length; i++) {
            buf.writeUint8(this._encodedMessage[i]);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._senderPubKey.serializedSize  
            + /*length*/ 4
            + /*timestamp*/ 4
            + 1 * this._length /* size of array = length * space for each 8 bit (1) */
    }

    get decodedMessage(){
        return this._decodedMessage;
    }

    get senderPubKey(){
        return this._senderPubKey;
    }

    get timestamp(){
        return this._timestamp;
    }
}
Class.register(DeliberationMessage);