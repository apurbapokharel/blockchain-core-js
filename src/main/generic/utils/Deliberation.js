class Deliberation extends Observable{
    /**
     * @param {String} problem
     * @param {Array<Uint32>} rounds
     * @param {Array<Uint32>} turns
     * @param {Array.<String(PublicKey)>} participants
    */
    constructor(problem, rounds, turns, participants, isEnded = true){
        super();
        this._problem = problem;
        this._totalRound = rounds;
        this._totalTurn = turns;
        this._participants = participants;
        this._currentRound = 1;
        this._currentTurn = 1;
        this._speakerIndex = 0;
        this._isEnd = isEnded;
    }

    // generateUtterance(){

    // }
    _error(msg) {
        this.fire('error', msg, this);
        Log.e(Deliberation, msg);
    }

    /**
     * 
     * @param {DeliberationMessage} msg 
     */
    registerUtterance(msg){
        // this.printDeliberationState();
        const sender = msg.senderPubKey.toHex();
        // console.log(sender, this.participants[this.speakerIndex], sender !== this.participants[this.speakerIndex]);
        
        // check if the deliberation is not already terminated
        if(this.isEnd || this.currentRound > this.totalRound){
            this._error('Deliberation already terminated');
            return false;
        }
        // check if the sender is the currentSpeaker
        if (sender !== this.participants[this.speakerIndex]){
            this._error('Message/Utterance speaking order violated');
            return false;
        }
        // check if the time has not exceeded
        // other checks

        this.increaseSpeakerIndex();
        this.printDeliberationState();
        return true;
    }

    // Only for testing
    printDeliberationState() {
        console.log("Current Round:", this._currentRound);
        console.log("Current Turn:", this._currentTurn);
        console.log("Speaker Index:", this._speakerIndex);
        console.log("Is Ended:", this._isEnd);
    }

    increaseRound(){
        this._currentRound +=1;

        if(this.currentRound > this.totalRound){
            this.endDeliberation();
        }
    }

    increaseTurn(){
        this._currentTurn +=1;

        if(this.currentTurn > this.totalTurn){
            this.increaseRound();
        }
    }

    endDeliberation(){
        this._isEnd = true;
    }

    increaseSpeakerIndex(){
        this._speakerIndex += 1;
        if(this.speakerIndex === this.participants.length){
            if(this.currentRound === 2){
                this.increaseTurn();
            }
            else{
                this.increaseRound();
            }
            this._speakerIndex = 0;
        }
    }

    get problem(){
        return this._problem;
    }

    get totalRound(){
        return this._totalRound;
    }

    get totalTurn(){
        return this._totalTurn;
    }

    get participants(){
        return this._participants;
    }

    get currentRound(){
        return this._currentRound;
    }

    get currentTurn(){
        return this._currentTurn;
    }

    get speakerIndex(){
        return this._speakerIndex;
    }

    get isEnd(){
        return this._isEnd;
    }
    
    get currentSpeaker(){
        return this._participants[this._speakerIndex]
    }
    
} 
Class.register(Deliberation);