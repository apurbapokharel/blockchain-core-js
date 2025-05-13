class DeliberationInit{
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
        this._decodedProblem = problem;
        this._rounds = rounds;
        this._turns = turns;
        this._participants = participants;
    }

    hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || Hash.light(this.serialize());
        return this._hash;
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

    static unserialize(buf) {
        let decoder = new TextDecoder();
        const length = buf.readUint32();
        const uint8Array = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            uint8Array[i] = buf.readUint8();
        }
        const rounds = buf.readUint32();
        const turns = buf.readUint32();
        const length2 = buf.readUint32();
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
        return new DeliberationInit(decodedProblem, rounds, turns, participants);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(this._lengthOfProblem);
        for (let i = 0; i < this._lengthOfProblem; i++) {
            buf.writeUint8(this._encodedProblem[i]);
        }
        buf.writeUint32(this._rounds);
        buf.writeUint32(this._turns);
        buf.writeUint32(this._totalLength);
        for (let i = 0; i < this._totalLength; i++) {
            buf.writeUint8(this._encodedParticipants[i]);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return 4
            + 1 * this._lengthOfProblem
            + 4 /*rounds*/
            + 4 /*turns*/
            + 4
            + 1 * this._totalLength /* size of array = length * space for each 8 bit (1) */
    }
}
Class.register(DeliberationInit);