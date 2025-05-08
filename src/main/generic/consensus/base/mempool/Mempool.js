const axios = require('axios');

class Mempool extends Observable {
    /**
     * @param {IBlockchain} blockchain
     * @param {Accounts} accounts
     */
    constructor(blockchain, accounts) {
        super();
        /** @type {IBlockchain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;

        // Our pool of transactions.
        /** @type {SortedList.<Transaction>} */
        this._transactionsByFeePerByte = new SortedList(); // uses Transaction.compare, by fee descending
        /** @type {HashMap.<Hash, Transaction>} */
        this._transactionsByHash = new HashMap();
        /** @type {HashMap.<Address, MempoolTransactionSet>} */
        this._transactionSetBySender = new HashMap();
        /** @type {HashMap.<Address, HashSet.<Hash>>} */
        this._transactionSetByRecipient = new HashMap();
        /** @type {MempoolFilter} */
        this._filter = new MempoolFilter();
        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        //@UP: For message mempool
        /** @type {HashMap.<Hash, DeliberationMessage>} */
        this._messagesByHash = new HashMap();

        //@UP: For init delimessage mempool
        /** @type {HashMap.<Hash, DeliberationInit>} */
        this._initMessageByHash = new HashMap();
        
        //@UP: To keep track of the deliberation state and order
        /** @type {Deliberation} */
        this._deliberation = new Deliberation();

        //@UP: Session id for a deliberation
        /** @type {String} */
        this._sessionId = "";

        //@UP:  
        // The value should have been DeliberationMessage but making its a string for storage purposes
        /** @type {HashMap.<(round,turn, speakerIndex), String>} */
        this._messagesByRounds = new HashMap();

        // Listen for changes in the blockchain head to evict transactions that have become invalid.
        blockchain.on('head-changed', (block, rebranching) => {
            if (!rebranching) {
                this._evictTransactions().catch(Log.e.tag(Mempool));
            }
        });
        blockchain.on('rebranched', async (revertBlocks) => {
            await this._evictTransactions();
            await this._restoreTransactions(revertBlocks);
        });
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<Mempool.ReturnCode>}
     */
    pushTransaction(transaction) {
        return this._synchronizer.push(() => this._pushTransaction(transaction));
    }


    //@UP: Adding replies to mapping so that they can be used during the reflection round
    addReplyToMapping(reply, currentRound, currentTurn, currentSpeaker){
        //the reply for the given round should not exist
        //arrays are used by reference so using string which are refered by value
        const tuple = [currentRound, currentTurn, currentSpeaker];
        const key = tuple.join(',');
        const status = this._messagesByRounds.contains(key);
        if(status){
            console.log("ERROR, THIS SHOULD NEVER BE THE CASE");            
        }
        else{
            this._messagesByRounds.put(key, reply);
        }
    }

    getPrevReply(currentRound, currentTurn, currentSpeakerIndex){
        // console.log("oarams",currentRound, currentTurn, currentSpeakerIndex);
        
        let neighIndex = currentSpeakerIndex - 1;
        let prevRound = 0;
        let prevTurn = 0;
        if(neighIndex == -1){
                neighIndex = this._deliberation.participants.length - 1; 
        }
        if(currentTurn == 2){
            prevTurn = currentTurn - 1;
            prevRound = currentRound;
        }
        else{
            prevTurn = currentTurn;
            prevRound = currentRound - 1;    
        }
        let key1 = [prevRound, prevTurn, currentSpeakerIndex];
        let key2 = [prevRound, prevTurn, neighIndex];
        key1 = key1.join(',');
        key2 = key2.join(',');
        // console.log(key1, key2);
        return [this._messagesByRounds.get(key1), this._messagesByRounds.get(key2)];
    }

    //@UP: for testing only
    async seeMapping(){
        
        for (const [key, value] of this._messagesByRounds.entryIterator()) {
            console.log(key, value);
        }

        // console.log(this._messagesByRounds.get("key"));
        // let key1 = [1, 2, 3];
        // key1 = key1.join(',');
        // this._messagesByRounds.put(key1, "I am in favor of AI regulation. AI regulation should be global. The government should establish an AI agency. The AI agency should set standards for AI development. AI developers should be licensed.")        
        // console.log(this._messagesByRounds.get(key1));        
        // this._messagesByRounds.remove(key1);
    }
    /**
     * @param {PublicKey} publicKeySender
    */    
    //@UP: This method can be exposed to reentrancy/DDoS/Resource Exhaustion Attacks.
    // If, we check address == currentSpeaker and generate new utterance but
    // we never increase the speakerIndex (push message does this primarily)
    // If that happens this function can be continously called to keep on generating new messages
    // FIX: we increase the speaker index so that we prevent this viscious cycle
    // FIX: we also push the message from this function so that function pushMessage's logic can be sperated for messaged that are relayed
    async generateAndSendMessage(publicKeySender){
        // check to see if address == currentSpeaker then genereate message
        // see the current round info to know which method to call with which parameters
        // create a new delibertaionMessage from reply
        // push message
        const currentSpeakerAddress = this._deliberation.currentSpeaker;
        const publicKeyHex = publicKeySender.toHex();
        if(currentSpeakerAddress === publicKeyHex){
            const currentRound = this._deliberation.currentRound;
            const currentTurn = this._deliberation.currentTurn; 
            const currentSpeakerIndex = this._deliberation.speakerIndex;
            this._deliberation.increaseSpeakerIndex();
            let response = "";
            // Can add independent logic for each round of deliberation and call seperate methods acordingly
            if(currentRound==1){
                response = await axios.post(`http://127.0.0.1:5000/round1`, {
                    params: {
                        session_id: this._sessionId
                    }
                });
            }
            else{
                const replies = this.getPrevReply(currentRound, currentTurn, currentSpeakerIndex);
                const user_reply = replies[0];
                const neighbour_reply = replies[1];
                // console.log("Replies", user_reply, neighbour_reply);
                //FIXME: Model sometime generates empty reponse so will loop till non empty response generated
                while(true){
                    response = await axios.post(`http://127.0.0.1:5000/round2`, {
                        params: {
                            session_id: this._sessionId,
                            user_reply: user_reply,
                            neighbour_reply: neighbour_reply
                        }
                    });
                    if(response.data.result.response.length != 0)
                        break;    
                }
            }
            let reply = response.data.result.response;
            reply = reply.replace(/\n/g, ' ').trim();
            this.addReplyToMapping(reply, currentRound, currentTurn, currentSpeakerIndex);
            console.log("generated reply is", reply);
            const message = new DeliberationMessage(reply, publicKeySender, Math.floor(Date.now()/1000));     
            message.encodeMessage();
            // console.log(message.hash());
            this._synchronizer.push(() => this._pushMessage(message));
        }
        else{
            console.log("Not current peers turn to speak");
        }
        this._deliberation.printDeliberationState();
    }

    // @UP
    /**
     * @param {DeliberationMessage} message
     * OR
     * @param {DeliberationInit} message
     * @param {PublicKey} ownAddress
    */  
    async pushMessage(message, ownAddress) { 
        if(message instanceof DeliberationInit){
            if (this._deliberation.problem === undefined || this._deliberation.isEnd){
                console.log("Init deli called");
                this._deliberation = new Deliberation(message._decodedProblem, message._rounds, message._turns, message._participants, false);
                const response = await axios.post(`http://127.0.0.1:5000/init`, {
                    params: {
                        problem: message._decodedProblem,
                        rounds: message._rounds,
                        turns: message._turns,
                        agents: message._participants
                    }
                });           
                this._sessionId = response.data.session_id;
                this._synchronizer.push(() => this._pushMessage(message));                
            }
            else{
                console.log("No need to init new deliberation");
            }
        }
        if(message instanceof DeliberationMessage){
            console.log("reply", message._decodedMessage);
            //1. check if the message can be accepted
                //a. Register utterance will check and return false 
                    // if deliberation is alread end or speaking turn violated
                //b. Register uttreance will also increase the turns and rounds appropriately
            const currentRound = this._deliberation.currentRound;
            const currentTurn = this._deliberation.currentTurn; 
            const currentSpeakerIndex = this._deliberation.speakerIndex;
            const status = this._deliberation.registerUtterance(message)
            if(status){
                this.addReplyToMapping(message.decodedMessage, currentRound, currentTurn, currentSpeakerIndex);
                //2. If the message can be accepted relay the message 
                this._synchronizer.push(() => this._pushMessage(message));
            }
            //3. Now check if its this peers turn to speak
            const currentSpeakerAddress = this._deliberation.currentSpeaker;
            if(currentSpeakerAddress === ownAddress.toHex() && ! this._deliberation.isEnd){
                //a. If then generateMsg and pushMessage again
                this.generateAndSendMessage(ownAddress);
            }
        }
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<Mempool.ReturnCode>}
     * @private
     */
    async _pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            return Mempool.ReturnCode.KNOWN;
        }

        // Check transaction against filter rules.
        if (!this._filter.acceptsTransaction(transaction)) {
            this._filter.blacklist(hash);
            return Mempool.ReturnCode.FILTERED;
        }

        // Check limit for free transactions.
        const set = this._transactionSetBySender.get(transaction.sender) || new MempoolTransactionSet();
        if (transaction.fee / transaction.serializedSize < Mempool.TRANSACTION_RELAY_FEE_MIN
            && set.numBelowFeePerByte(Mempool.TRANSACTION_RELAY_FEE_MIN) >= Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX) {
            return Mempool.ReturnCode.FEE_TOO_LOW;
        }

        // Intrinsic transaction verification
        if (!transaction.verify()) {
            return Mempool.ReturnCode.INVALID;
        }

        // Retrieve recipient account and test incoming transaction.
        /** @type {Account} */
        try {
            const recipientAccount = await this._accounts.get(transaction.recipient);
            const newRecipientAccount = recipientAccount
                .withIncomingTransaction(transaction, this._blockchain.height + 1)
                .withContractCommand(transaction, this._blockchain.height + 1);

            // Check recipient account against filter rules.
            if (!this._filter.acceptsRecipientAccount(transaction, recipientAccount, newRecipientAccount)) {
                this._filter.blacklist(hash);
                return Mempool.ReturnCode.FILTERED;
            }
        } catch (e) {
            Log.d(Mempool, () => `Rejected transaction ${hash.toHex()} from ${transaction.sender.toUserFriendlyAddress()} - ${e.message}`);
            return Mempool.ReturnCode.INVALID;
        }

        // Retrieve sender account.
        /** @type {Account} */
        let senderAccount;
        try {
            senderAccount = await this._accounts.get(transaction.sender, transaction.senderType);
        } catch (e) {
            Log.d(Mempool, () => `Rejected transaction ${hash.toHex()} from ${transaction.sender.toUserFriendlyAddress()} - ${e.message}`);
            return Mempool.ReturnCode.INVALID;
        }

        // Add new transaction to the sender's pending transaction set. Then re-check all transactions in the set
        // in fee/byte order against the sender account state. Adding high fee transactions may thus invalidate
        // low fee transactions in the set.
        const transactions = [];
        const txsToRemove = [];
        let tmpAccount = senderAccount;
        for (const tx of set.copyAndAdd(transaction).transactions) {
            let error = 'transactions per sender exceeded';
            let exception;
            try {
                if (transactions.length < Mempool.TRANSACTIONS_PER_SENDER_MAX) {
                    tmpAccount = tmpAccount.withOutgoingTransaction(tx, this._blockchain.height + 1, this._blockchain.transactionCache);
                    transactions.push(tx);

                    // Transaction ok, move to next one.
                    continue;
                }
            } catch (e) {
                exception = e;
                error = e.message;
            }

            // An error occurred processing this transaction.
            // If the rejected transaction is the one we're pushing, fail.
            // Otherwise, evict the rejected transaction from the mempool.
            if (tx.equals(transaction)) {
                Log.d(Mempool, () => `Rejected transaction from ${transaction.sender.toUserFriendlyAddress()} - ${error}`);
                if (exception instanceof Account.DoubleTransactionError) {
                    return Mempool.ReturnCode.MINED;
                } else if (exception instanceof Account.ValidityError) {
                    return Mempool.ReturnCode.EXPIRED;
                } else {
                    return Mempool.ReturnCode.INVALID;
                }
            } else {
                txsToRemove.push(tx);
            }
        }

        // Check sender account against filter rules.
        if (!this._filter.acceptsSenderAccount(transaction, senderAccount, tmpAccount)) {
            this._filter.blacklist(hash);
            return Mempool.ReturnCode.FILTERED;
        }

        // Remove invalidated transactions.
        for (const tx of txsToRemove) {
            this._removeTransaction(tx);
        }

        // Transaction is valid, add it to the mempool.
        this._transactionsByFeePerByte.add(transaction);
        this._transactionsByHash.put(hash, transaction);
        this._transactionSetBySender.put(transaction.sender, new MempoolTransactionSet(transactions));
        /** @type {HashSet.<Hash>} */
        const byRecipient = this._transactionSetByRecipient.get(transaction.recipient) || new HashSet();
        byRecipient.add(transaction.hash());
        this._transactionSetByRecipient.put(transaction.recipient, byRecipient);

        // Tell listeners about the new valid transaction we received.
        this.fire('transaction-added', transaction);

        if (this._transactionsByFeePerByte.length > Mempool.SIZE_MAX) {
            this._popLowFeeTransaction();
        }

        return Mempool.ReturnCode.ACCEPTED;
    }

    // @UP
    async _pushMessage(message) {
        // Check if we already know this message.
        const hash = message.hash();        
        if (this._messagesByHash.contains(hash) || this._initMessageByHash.contains(hash)) {
            return Mempool.ReturnCode.KNOWN;
        }

        if(message instanceof DeliberationInit){
            this._initMessageByHash.put(hash, message);
        }
        else{
            this._messagesByHash.put(hash, message);
        }

        this.fire('message-added', message);

        return Mempool.ReturnCode.ACCEPTED;
    }

    /**
     * @private
     */
    _popLowFeeTransaction() {
        // Remove transaction
        const transaction = this._transactionsByFeePerByte.pop();

        /** @type {MempoolTransactionSet} */
        const set = this._transactionSetBySender.get(transaction.sender);
        set.remove(transaction);
        if (set.length === 0) this._transactionSetBySender.remove(transaction.sender);

        /** @type {HashSet.<Hash>} */
        const byRecipient = this._transactionSetByRecipient.get(transaction.recipient);
        if (byRecipient) {
            if (byRecipient.length === 1) {
                this._transactionSetByRecipient.remove(transaction.recipient);
            } else {
                byRecipient.remove(transaction.hash());
            }
        } else {
            Log.e(Mempool, `Invalid state: no transactionsByRecipient for ${transaction}`);
        }

        this._transactionsByHash.remove(transaction.hash());
        this.fire('transaction-removed', transaction);
    }

    /**
     * Does *not* remove transaction from transactionsBySender!
     * @param {Transaction} transaction
     * @private
     */
    _removeTransaction(transaction) {
        this._transactionsByHash.remove(transaction.hash());

        // TODO: Optimise remove from this._transactionsByMinFee.
        this._transactionsByFeePerByte.remove(transaction);

        /** @type {HashSet.<Hash>} */
        const byRecipient = this._transactionSetByRecipient.get(transaction.recipient);
        if (byRecipient) {
            if (byRecipient.length === 1) {
                this._transactionSetByRecipient.remove(transaction.recipient);
            } else {
                byRecipient.remove(transaction.hash());
            }
            this.fire('transaction-removed', transaction);
        } else {
            Log.e(Mempool, `Invalid state: no transactionsByRecipient for ${transaction}`);
        }
    }

    /**
     * @param {Hash} hash
     * @returns {Transaction}
     */
    getTransaction(hash) {
        return this._transactionsByHash.get(hash);
    }

    // @UP
    /**
     * @param {Hash} hash
     * @returns {DeliberationMessage}
     */
    getMessage(hash) {
        return this._messagesByHash.get(hash);
    }

    // @UP
    /**
     * @param {Hash} hash
     * @returns {DeliberationInit}
     */
    getInitMessage(hash) {
        return this._initMessageByHash.get(hash);
    }

    /**
     * @param {number} [maxSize]
     * @param {number} [minFeePerByte]
     * @yields {IterableIterator.<Transaction>}
     */
    *transactionGenerator(maxSize = Infinity, minFeePerByte = 0) {
        let size = 0;
        for (const /** @type {Transaction} */ tx of this._transactionsByFeePerByte) {
            const txSize = tx.serializedSize;
            if (size + txSize >= maxSize) continue;
            if (tx.feePerByte < minFeePerByte) break;

            yield tx;
            size += txSize;
        }
    }

    /**
     * @param {number} [maxSize]
     * @param {number} [minFeePerByte]
     * @returns {Array.<Transaction>}
     */
    getTransactions(maxSize = Infinity, minFeePerByte = 0) {
        return Array.from(this.transactionGenerator(maxSize, minFeePerByte));
    }

    // @UP
    /**
     * @param {number} [maxSize]
     * @yields {IterableIterator.<Transaction>}
     */
    *messageGenerator(maxSize = Infinity) {
        let size = 0;
        for (const [hash, msg] of this._messagesByHash.entryIterator()) {

        // for (const /** @type {DeliberationMessage} */ msg of this._messagesByHash) {
            const msgSize = msg.serializedSize;
            if (size + msgSize >= maxSize) continue;

            yield msg;
            size += msgSize;
        }
    }
    
    // @UP
    /**
     * @param {number} [maxSize]
     * @returns {Array.<Transaction>}
     */
    getMessages(maxSize = Infinity) {
        return Array.from(this.messageGenerator(maxSize));
    }


    /**
     * @param {number} maxSize
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getTransactionsForBlock(maxSize) {
        const transactions = this.getTransactions(maxSize);
        const prunedAccounts = await this._accounts.gatherToBePrunedAccounts(transactions, this._blockchain.height + 1, this._blockchain.transactionCache);
        const prunedAccountsSize = prunedAccounts.reduce((sum, acc) => sum + acc.serializedSize, 0);

        let size = prunedAccountsSize + transactions.reduce((sum, tx) => sum + tx.serializedSize, 0);
        while (size > maxSize) {
            size -= transactions.pop().serializedSize;
        }

        transactions.sort((a, b) => a.compareBlockOrder(b));
        return transactions;
    }

    // @UP
    /**
     * @param {number} maxSize
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getMessagesForBlock(maxSize) {
        const messages = this.getMessages(maxSize);
        return messages;
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getPendingTransactions(address) {
        return this.getTransactionsBySender(address);
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getTransactionsBySender(address) {
        /** @type {MempoolTransactionSet} */
        const set = this._transactionSetBySender.get(address);
        return set ? set.transactions : [];
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getTransactionsByRecipient(address) {
        /** @type {HashSet.<Hash>} */
        const set = this._transactionSetByRecipient.get(address);
        if (!set) {
            return [];
        }

        /** @type {Array.<Transaction>} */
        const transactions = [];
        for (const hash of set.valueIterator()) {
            const tx = this._transactionsByHash.get(hash);
            Assert.that(!!tx);
            transactions.push(tx);
        }
        return transactions;
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {number} [maxTransactions]
     * @return {Array.<Transaction>}
     */
    getTransactionsByAddresses(addresses, maxTransactions = Infinity) {
        const transactions = [];
        for (const address of addresses) {
            // Fetch transactions by sender first
            /** @type {Array.<Transaction>} */
            const bySender = this.getTransactionsBySender(address);
            for (const tx of bySender) {
                if (transactions.length >= maxTransactions) return transactions;
                transactions.push(tx);
            }

            // Fetch transactions by recipient second
            /** @type {Array.<Transaction>} */
            const byRecipient = this.getTransactionsByRecipient(address);
            for (const tx of byRecipient) {
                if (transactions.length >= maxTransactions) return transactions;
                transactions.push(tx);
            }
        }
        return transactions;
    }

    /**
     * @param {number} minFeePerByte
     */
    evictBelowMinFeePerByte(minFeePerByte) {
        /** @type {Transaction} */
        let transaction = this._transactionsByFeePerByte.peekLast();
        while (transaction && transaction.feePerByte < minFeePerByte) {
            this._transactionsByFeePerByte.pop();

            this._transactionsByHash.remove(transaction.hash());

            /** @type {MempoolTransactionSet} */
            const bySender = this._transactionSetBySender.get(transaction.sender);
            if (bySender.length === 1) {
                this._transactionSetBySender.remove(transaction.sender);
            } else {
                bySender.remove(transaction);
            }
            /** @type {HashSet.<Hash>} */
            const byRecipient = this._transactionSetByRecipient.get(transaction.recipient);
            if (byRecipient.length === 1) {
                this._transactionSetByRecipient.remove(transaction.recipient);
            } else {
                byRecipient.remove(transaction.hash());
            }

            transaction = this._transactionsByFeePerByte.peekLast();
        }
    }

    /**
     * @param {Hash} txHash
     * @returns {boolean}
     */
    isFiltered(txHash) {
        return this._filter.isBlacklisted(txHash);
    }

    /**
     * @param {Array.<Block>} blocks
     * @returns {Promise}
     * @private
     */
    _restoreTransactions(blocks) {
        return this._synchronizer.push(async () => {
            for (let i = blocks.length - 1; i >= 0; i--) {
                for (const tx of blocks[i].transactions) {
                    await this._pushTransaction(tx); // eslint-disable-line no-await-in-loop
                }
            }
        });
    }

    /**
     * @fires Mempool#transactions-ready
     * @returns {Promise}
     * @private
     */
    _evictTransactions() {
        return this._synchronizer.push(() => this.__evictTransactions());
    }

    /**
     * @fires Mempool#transactions-ready
     * @returns {Promise}
     * @private
     */
    async __evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        for (const sender of this._transactionSetBySender.keys()) {
            /** @type {MempoolTransactionSet} */
            const set = this._transactionSetBySender.get(sender);

            try {
                const senderAccount = await this._accounts.get(set.sender, set.senderType);

                // If a transaction in the set is not valid anymore,
                // we try to construct a new set based on the heuristic of including
                // high fee/byte transactions first.
                const transactions = [];
                let account = senderAccount;
                for (const tx of set.transactions) {
                    try {
                        const tmpAccount = account.withOutgoingTransaction(tx, this._blockchain.height + 1, this._blockchain.transactionCache);

                        const recipientAccount = await this._accounts.get(tx.recipient);
                        recipientAccount
                            .withIncomingTransaction(tx, this._blockchain.height + 1)
                            .withContractCommand(tx, this._blockchain.height + 1);

                        transactions.push(tx);
                        account = tmpAccount;
                    } catch (e) {
                        // Remove transaction
                        this._removeTransaction(tx);
                    }
                }
                if (transactions.length === 0) {
                    this._transactionSetBySender.remove(sender);
                } else {
                    this._transactionSetBySender.put(sender, new MempoolTransactionSet(transactions));
                }
            } catch (e) {
                // In case of an error, remove all transactions of this set.
                for (const tx of set.transactions) {
                    this._removeTransaction(tx);
                }
                this._transactionSetBySender.remove(sender);
            }
        }

        //@UP: Remove the messages from the mempool
        for (const [hash, msg] of this._messagesByHash.entryIterator()) {
            this._messagesByHash.remove(hash)
        }

        // Tell listeners that the pool has updated after a blockchain head change.
        /**
         * @event Mempool#transactions-ready
         */
        this.fire('transactions-ready');
    }

    /** @type {number} */
    get length() {
        return this._transactionsByHash.length;
    }

    /** @type {Synchronizer} */
    get queue() {
        return this._synchronizer;
    }
}

/**
 * Fee threshold in sat/byte below which transactions are considered "free".
 * @type {number}
 */
Mempool.TRANSACTION_RELAY_FEE_MIN = 1;
/**
 * Maximum number of transactions per sender.
 * @type {number}
 */
Mempool.TRANSACTIONS_PER_SENDER_MAX = 500;
/**
 * Maximum number of "free" transactions per sender.
 * @type {number}
 */
Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX = 10;
/**
 * Maximum number of transactions in the mempool.
 * @type {number}
 */
Mempool.SIZE_MAX = 50000;

/** @enum {number} */
Mempool.ReturnCode = {
    EXPIRED: -5,
    MINED: -4,
    FILTERED: -3,
    FEE_TOO_LOW: -2,
    INVALID: -1,

    ACCEPTED: 1,
    KNOWN: 2
};

Class.register(Mempool);
