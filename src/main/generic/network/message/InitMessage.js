class InitMessage extends Message{
    /**
     * @param {String} problem
     * @param {Array<Uint32>} rounds
     * @param {Array<Uint32>} turns
     * @param {Array.<String(PublicKey)>} participants
     * Additional params not included
     * @param {Uint32} timeStamp
     * @param {Uint32} completionTimeStamp
     * @param {Uint32} confidenceInConsensus
    */
    constructor(problem, rounds, turns, participants){
        super(Message.Type.INITMSG);
        this._decodedProblem = problem;
        this._rounds = rounds;
        this._turns = turns;
        this._participants = participants;
    }

    encodeMessage(){
        let encoder = new TextEncoder();
        this._encodedProblem = encoder.encode(this._decodedProblem);
        this._lengthOfProblem = this._encodedProblem.length;

        this._lengthOfParticipants = this._participants.length;        
        let encodedParticipantsArray = this._participants.map(str => {
            return encoder.encode(str);
        });
        this._totalLength = this._lengthOfParticipants * 64;
        this._encodedParticipants = new Uint8Array(this._totalLength);
        let offset = 0;
        for (const arr of encodedParticipantsArray) {
            this._encodedParticipants.set(arr, offset);
            offset += arr.length;
        }                
    }

    // hash() {
    //     // Exclude the signature, we don't want transactions to be malleable.
    //     this._hash = this._hash || Hash.light(this.serialize());
    //     return this._hash;
    // }

    static unserialize(buf) {
        Message.unserialize(buf);
        let decoder = new TextDecoder();
        const length = buf.readUint8();
        const uint8Array = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            uint8Array[i] = buf.readUint8();
        }
        const rounds = buf.readUint32();
        const turns = buf.readUint32();
        const length2 = buf.readUint8();
        const uint8Array2 = new Uint8Array(length2);
        for (let i = 0; i < length2; i++) {
            uint8Array2[i] = buf.readUint8();
        }
        const result = [];
        for (let i = 0; i < length2; i += 64) {
            result.push(uint8Array2.slice(i, i + 64));
        }
        let participants = [];
        for(const arr of result){
            participants.push(decoder.decode(arr));
        }
        let decodedProblem = decoder.decode(uint8Array);
        return new InitMessage(decodedProblem, rounds, turns, participants);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint8(this._lengthOfProblem);
        for (let i = 0; i < this._lengthOfProblem; i++) {
            buf.writeUint8(this._encodedProblem[i]);
        }
        buf.writeUint32(this._rounds);
        buf.writeUint32(this._turns);
        buf.writeUint8(this._totalLength);
        for (let i = 0; i < this._totalLength; i++) {
            buf.writeUint8(this._encodedParticipants[i]);
        }
        super._setChecksum(buf);
        return buf;
    }

     /** @type {number} */
     get serializedSize() {
        return super.serializedSize 
            + 1
            + 1 * this._lengthOfProblem
            + 4 /*rounds*/
            + 4 /*turns*/
            + 1
            + 1 * this._totalLength /* size of array = length * space for each 8 bit (1) */
    }
}
Class.register(InitMessage);