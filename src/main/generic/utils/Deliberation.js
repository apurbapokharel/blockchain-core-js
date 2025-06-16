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
        // time is saved in millisecond unix time
        this._startTime = -1;
        this._endTime = -1;
        // [
        // 0 : (deliberation_start, round1_start), 
        // 1 : (round1_end, round2_start, turn1_start),
        // 2: (turn1_end, turn2_start),
        // 3: (turn2_end, round2_end, deliberation_end)
        // ]
        this._roundTimes = [];
    }

    // generateUtterance(){

    // }
    _error(msg) {
        this.fire('error', msg, this);
        Log.e(Deliberation, msg);
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const ms = milliseconds % 1000;
        return `${days}d ${hours}h ${minutes}m ${secs}s ${ms}ms`;
    }

    /**
     * 
     * @param {DeliberationMessage} msg 
     */
    registerUtterance(msg){
        if(this.startTime == -1){
            console.log("set start time");
            this.startDeliberation();
        }
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
        this._endTime = Date.now();
        this._isEnd = true;
    }

    startDeliberation(){
        const startTime = Date.now();
        this._roundTimes.push(startTime)
        this._startTime = startTime;
    }

    increaseSpeakerIndex(){
        this._speakerIndex += 1;
        if(this.speakerIndex === this.participants.length){
            console.log("appending to times");
            const time = Date.now();
            this._roundTimes.push(time)
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
        return this._participants[this._speakerIndex];
    }

    get startTime(){
        return this._startTime;
    }

    get endTime(){
        return this._endTime;
    }
    
    get roundTime(){
        return this._roundTimes;
    }
} 
Class.register(Deliberation);