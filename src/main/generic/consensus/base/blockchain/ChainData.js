class ChainData {
    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    // static async initial(block, superBlockCounts) {
    static async initial(block) {
        // const pow = await block.pow();
        // const totalWork = BlockUtils.realDifficulty(pow);

        // const depth = BlockUtils.getHashDepth(pow);
        // if (superBlockCounts) {
        //     superBlockCounts = superBlockCounts.copyAndAdd(depth);
        // } else {
        //     superBlockCounts = new SuperBlockCounts();
        //     superBlockCounts.add(depth);
        // }
        //         return new ChainData(block, block.difficulty, totalWork, superBlockCounts, true);

        return new ChainData(block, true);
    }

    /**
     * @param {Block} head
     * @param {boolean} [onMainChain]
     * @param {Hash} [mainChainSuccessor]
     */
    constructor(head, onMainChain = false, mainChainSuccessor = null) {
        this._head = head;
        this._onMainChain = onMainChain;
        this._mainChainSuccessor = mainChainSuccessor;
        this._height = head.height;
    }

    /**
     * @returns {{_head: SerialBuffer, _onMainChain: boolean, _mainChainSuccessor: ?SerialBuffer, _height: number}}
     */
    toObj() {
        // Assert.that(this._head.header._pow instanceof Hash, 'Expected cached PoW hash');
        return {
            _head: this._head.toLight().serialize(),
            _onMainChain: this._onMainChain,
            _mainChainSuccessor: this._mainChainSuccessor ? this._mainChainSuccessor.serialize() : null,
            _height: this._head.height
        };
    }

    /**
     * @param {{_head: Uint8Array, _onMainChain: boolean, _mainChainSuccessor: ?Uint8Array, _height: number, _pow: Uint8Array}} obj
     * @param {string} [hashBase64]
     * @returns {ChainData}
     */
    static fromObj(obj, hashBase64) {
        if (!obj) return null;
        const head = Block.unserialize(new SerialBuffer(obj._head));
        // head.header._pow = Hash.unserialize(new SerialBuffer(obj._pow));
        head.header._hash = hashBase64 ? Hash.fromBase64(hashBase64) : null;
        const successor = obj._mainChainSuccessor ? Hash.unserialize(new SerialBuffer(obj._mainChainSuccessor)) : null;
        return new ChainData(
            head,
            obj._onMainChain,
            successor
        );
    }

    /**
     * @returns {ChainData}
     */
    shallowCopy() {
        return new ChainData(this.head.shallowCopy(), this.onMainChain, this.mainChainSuccessor);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    async nextChainData(block) {
        // Assert.that(this._totalDifficulty > 0);

        // const pow = await block.pow();
        // const totalDifficulty = this.totalDifficulty.plus(block.difficulty);
        // const totalWork = this.totalWork.plus(BlockUtils.realDifficulty(pow));
        // const superBlockCounts = this.superBlockCounts.copyAndAdd(BlockUtils.getHashDepth(pow));
        // return new ChainData(block, totalDifficulty, totalWork, superBlockCounts);

        //TODO: APU: create new chainData
        return new ChainData(block);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<ChainData>}
     */
    async previousChainData(block) {
        return new ChainData(block);
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {boolean} */
    get onMainChain() {
        return this._onMainChain;
    }

    /** @type {boolean} */
    set onMainChain(onMainChain) {
        this._onMainChain = onMainChain;
    }

    /** @type {Hash} */
    get mainChainSuccessor() {
        return this._mainChainSuccessor;
    }

    /** @type {Hash} */
    set mainChainSuccessor(mainChainSuccessor) {
        this._mainChainSuccessor = mainChainSuccessor;
    }
}
Class.register(ChainData);

class SuperBlockCounts {
    /**
     * @constructor
     * @param {Array.<number>} array
     */
    constructor(array = []) {
        this._arr = array;
    }

    /**
     * @param {number} depth
     */
    add(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        for (let i = 0; i <= depth; i++) {
            this._arr[i] = this.get(i) + 1;
        }
    }

    /**
     * @param {number} depth
     */
    subtract(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        for (let i = 0; i <= depth; i++) {
            this._arr[i]--;
            Assert.that(this._arr[i] >= 0);
        }
    }

    /**
     * @param {number} depth
     * @returns {SuperBlockCounts}
     */
    copyAndAdd(depth) {
        const copy = new SuperBlockCounts(this._arr.slice());
        copy.add(depth);
        return copy;
    }

    /**
     * @param {number} depth
     * @returns {SuperBlockCounts}
     */
    copyAndSubtract(depth) {
        const copy = new SuperBlockCounts(this._arr.slice());
        copy.subtract(depth);
        return copy;
    }

    /**
     * @param {number} depth
     * @returns {number}
     */
    get(depth) {
        Assert.that(NumberUtils.isUint8(depth));
        return this._arr[depth] || 0;
    }

    /**
     * @param {number} m
     * @returns {number}
     */
    getCandidateDepth(m) {
        for (let i = this._arr.length - 1; i >= 0; i--) {
            if (this._arr[i] >= m) {
                return i;
            }
        }
        return 0;
    }

    /** @type {number} */
    get length() {
        return this._arr.length;
    }

    /** @type {Array.<number>} */
    get array() {
        return this._arr;
    }
}
Class.register(SuperBlockCounts);
