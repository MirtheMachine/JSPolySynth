/**
 * # synthesizer.js
 * ### Written by Mirthe_
 *
 * Synthesizer object with noteOn(note) and noteOff(note) functions
 * * Contains parameters/variables for oscillator type, voices, detune, enveloping, and filtering
 * * Current oscillator and envelope parameters are applied with each noteOn() to a new soundOscillator.
 * * Supports (hopefully) unlimited polyphony!
 *
 * ### !!!!!!!!!! IMPORTANT INFO BELOW !!!!!!!!!!!
 * MUST HAVE AN `audioContext` OBJECT IN SCRIPT USING THIS OBJECT.
 * * `audioContext` must be initialized to `window.audioContext` by an event listener.
 *
 * Above required by Web Audio API specification
 */

/**
 * Synthesizer object containing
 * SoundOscillators, Notes, Effects, and Parameters
 * * Trigger a voice to play via noteOn(midiNote)
 * * Trigger a voice to release via noteOff(midiNote)
 * * Get human-readable note statistics via logNotesSummary()
 * @param {"sine" | "square" | "triangle" | "sawtooth" | "custom" } oscType
 * @param {"allpass" | "bandpass" | "highpass" | "highshelf" | "lowpass" | "lowshelf" | "notch" | "peaking"} filterType
 * @constructor
 */

class Synthesizer {
    constructor(destination, oscTypeI = "sine", filterType = "lowpass") {
        /**
         * Destination node for soundOscillators to connect to
         * @private
         */
        this._destination = destination;

        /**
         * List containing all member nodes/insert effects for
         * interacting with the Synthesizer object
         * @type {[effects: AudioNode]}
         */
        this.effectList = [];

        /**
         * Below note lists map midi notes(index) to soundOscillator[]
         */
        /**
         * Note list of notes in noteOn event state
         * @type {*[][]}
         */
        this.noteOnList = [[]];
        this.noteOnList.splice(0);

        /**
         * Note list of notes in release state
         * @type {*[][]}
         */
        this.noteOffList = [[]];
        this.noteOffList.splice(0);

        /**
         * Array of ID's of currently running note release timeOuts
         * @type {number[]}
         */
        this.timeOutList = [];
        this.timeOutList.splice(0);

        // ------- Synth Params ------- //

        this._oscType = oscTypeI;
        this._filterType = filterType;

        this._maxVolume = 1;
        this._voices = 1;
        this._detune = 0;

        this._filterFrequency = 24000.0;
        this._filterBandwidth = 1;

        // ------ Envelope Params ------ //

        this._geDepth = 1;
        this._geA = 96;
        this._geD = 224;
        this._geS = 0.25;
        this._geR = 1080;

        this._envelopeFilter = false;
        this._feDepth = 0;
        this._feA = 1;
        this._feD = 1;
        this._feS = .9;
        this._feR = 1;

    }

    // ----- Note play and panic functions ----- //

    /**
     * Creates a new soundOscillator at given midi note's calculated frequency (standard tuning)
     * <br>* Converts midi note to a musical frequency at standard tuning (440hz)
     * <br>* Applies current synth master parameters on newly created soundOscillator
     * <br>* Envelopes the soundOscillator.gainNode.gain value according to this.ge{A/D/S}
     * @param {number} note Midi note value
     */
    noteOn(note) {
        function noteFreq(note) {
            return 440 * Math.pow(2, (note - 69) / 12);
        }

        let createdOsc = createSOsc(this._voices, this._detune,
            this._oscType, this._maxVolume, noteFreq(note),
            this._filterType, this._filterFrequency, this._filterBandwidth);

        if (this.noteOnList[note]) {
            //pushes a new soundOscillator (can have a soundOscillator releasing on the same note)
            this.noteOnList[note].push(createdOsc);
        } else {
            //sets noteList[note] to a standard soundOscillator array with a singular soundOscillator
            this.noteOnList[note] = [createdOsc];
        }
        //Log voice creation
        //console.log("Voice created on note: " + note);
        //this.logNoteInfo(note);

        //initialize new soundOscillator gain volume for enveloping
        const newOSCParam = createdOsc.gainNode.gain;
        newOSCParam.cancelScheduledValues(0);
        newOSCParam.exponentialRampToValueAtTime(0.001, 0);

        //get values of CSC envelope progress nodes
        let attackProgress = createdOsc.envelopeProgress.attack;
        let decayProgress = createdOsc.envelopeProgress.decay;

        this.cancelAndHold(newOSCParam);

        //schedule attack/decay
        this.attack(newOSCParam, this.geA);

        this.cancelAndHold(attackProgress);
        this.cancelAndHold(decayProgress);
        //schedule attack/decay progress timers
        attackProgress.linearRampToValueAtTime(0, audioContext.currentTime + (this.geA/1000));
        decayProgress.setValueAtTime(1, audioContext.currentTime + (this.geA/1000));
        decayProgress.linearRampToValueAtTime(0, audioContext.currentTime + ((this.geA+this.geD)/1000));

        //connect 'master' soundOscillator node to synthesizer's destination
        createdOsc.filterNode.connect(this._destination);
    }

    attack(oscParam, attack) {
        this.cancelAndHold(oscParam);
        //schedule attack ramp
        oscParam.exponentialRampToValueAtTime(.993, audioContext.currentTime + (attack / 1000));
        this.decay(oscParam, attack, this.geD);
        //oscParam.cancelScheduledValues(audioContext.currentTime + attack/1000);
    }

    decay(oscParam, attack, decay) {
        this.cancelAndHold(oscParam, false);
        oscParam.linearRampToValueAtTime(this.geS, audioContext.currentTime + ((decay+attack) / 1000));
    }

    /**
     * Triggers a release envelope for least recent soundOscillator on given note
     * <br> * Exchanges soundOscillator from noteOnList to noteOffList
     * <br> * Triggers note release for this.geR milliseconds
     * <br> * NOTE: Thank you to Jake (Ozzy64k) for never leaving my brain until I got this right
     * @param {number} note Midi note value
     */
    noteOff(note) {
        if (this.checkNoteOn(note)) {
            //exchange oscillator from noteOnList to noteOffList
            if(note in this.noteOffList)this.noteOffList[note].push(this.noteOnList[note].pop());
            else this.noteOffList[note] = [this.noteOnList[note].pop()];

            this.release(note, this.geR);

            //Log voice releasing
            /**
             this.timeOutList.push(setTimeout((note) => {
                    console.log("Voice stopped on note: " + note);
                    this.logNoteInfo(note);
                }, this.geR, note));
             */
        }
    }

    release(note, releaseTime) {
        let oscIndex = this.noteOffList[note].length - 1;
        let oscParam = this.noteOffList[note][oscIndex].gainNode.gain;
        let oscReleaseTimer = this.noteOffList[note][oscIndex].envelopeProgress.release;

        this.cancelAndHold(oscParam);

        //ramp oscParam value to near 0 after this.geR milliseconds
        oscParam.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + (releaseTime / 1000));

        //log release progress
        //console.log(this.noteOffList[note][this.noteOffList[note].length-1].envelopeProgress.release.value);

        //schedule release progress timer
        this.cancelAndHold(oscReleaseTimer);
        oscReleaseTimer.linearRampToValueAtTime(0, audioContext.currentTime + (releaseTime / 1000));

        //create timeOut with delay of releaseTime and push id to timeOutList
        //timeOut function stops and removes soundOscillator from offList[note] + deletes its ID from the timeOutList
        this.timeOutList.push(setTimeout((offList, note, timeOutList) => {
            if (offList[note]) {
                //stop all voices in soundOscillator
                offList[note][0].oscillators.forEach((osc) => {
                    osc.stop(0);
                });

                //delete stopped soundOscillator
                offList[note].splice(0, 1);
                timeOutList.splice(0, 1);
            }
        }, releaseTime, this.noteOffList, note, this.timeOutList));
    }

    cancelAndHold(oscParam, now=true) {
        /**
         * Old value for cancel and hold
         */
        let oldValue = oscParam.value;
        //cancel and hold stage
        if(now === true){oscParam.cancelScheduledValues(0); }
        oscParam.linearRampToValueAtTime(oldValue, now? 0: audioContext.currentTime);
    }

    /**
     * Deletes all oscillators in lists + clears all note release timeouts
     */
    panic() {
        for (let i = 0, l = this.noteOnList.length; i < l; i++){
            if(this.checkNoteOn(i)){
                this.noteOnList[i].forEach((soundOscillator) => {
                    soundOscillator.oscillators.forEach((osc) => {osc.stop(0)});
                });
                this.noteOnList[i].splice(0);
                console.log("Stopped all running sound on note: " + i);
            }
        }
        for (let i = 0, l = this.noteOffList.length; i < l; i++){
            if(this.checkNoteOff(i)){
                this.noteOffList[i].forEach((soundOscillator) => {
                    soundOscillator.oscillators.forEach((osc) => {osc.stop(0)});
                });
                this.noteOffList[i].splice(0);
                console.log("Stopped all releasing sound on note: " + i);
            }
        }
        for (let t in this.timeOutList){
            window.clearTimeout(this.timeOutList[t]);
            //console.log("terminated timeout id: " + this.timeOutList[t]);
        }
        this.noteOnList.splice(0);
        this.noteOffList.splice(0);
        this.timeOutList.splice(0);
    }

    // ------------------------------- //

    //-- dynamic setters and getters --//

    get geR() {
        return this._geR;
    }

    set geR(newRelease) {
        this._geR = newRelease;
        for (let id in this.timeOutList){
            window.clearTimeout(this.timeOutList[id]);
        }
        this.timeOutList.splice(0);
        let modNotes = this.getOffNoteIndexes();
        modNotes.forEach((note) => {
            for (let i in this.noteOffList[note]){
                let progress = this.noteOffList[note][i].envelopeProgress.release.value;
                this.release(note, newRelease * progress);
            }
        });
    }


    get geA() {
        return this._geA;
    }

    set geA(value) {
        this._geA = value;
        let modNotes = this.getOnNoteIndexes();
        modNotes.forEach((note) => {
            this.noteOnList[note].forEach((noteGroup) => {
                let progress = noteGroup.envelopeProgress.attack;
                let dProgress = noteGroup.envelopeProgress.decay;
                console.log(progress.value);

                //reset attack progress ramp
                this.cancelAndHold(progress);
                this.cancelAndHold(dProgress);
                let modValue = value * progress.value;
                progress.linearRampToValueAtTime(0, audioContext.currentTime + (modValue / 1000));
                dProgress.setValueAtTime(1, audioContext.currentTime + (modValue / 1000));
                dProgress.linearRampToValueAtTime(0, audioContext.currentTime + (this.geD /1000));
                //re-calculate attack timing if note still in attack stage
                this.cancelAndHold(noteGroup.gainNode.gain);
                if(modValue>0)this.attack(noteGroup.gainNode.gain, modValue);
                else this.decay(noteGroup.gainNode.gain, modValue, this.geD * dProgress.value);
            });
        });

        //console test code
        /*
        function thing(){s.geA = 500}
        s.geA = 5000
        setTimeout(thing, 1000)
        */
    }

    get geD() {
        return this._geD;
    }

    set geD(value) {
        this._geD = value;
        let modNotes = this.getOnNoteIndexes();
        modNotes.forEach((note) => {
            this.noteOnList[note].forEach((noteGroup) => {
                let progress = noteGroup.envelopeProgress.decay;
                let aProgress = noteGroup.envelopeProgress.attack;

                //console.log(aProgress.value, progress.value);
                let aValue = this.geA * aProgress.value;
                let modValue = value * progress.value;
                //reset progress ramp
                this.cancelAndHold(progress);
                console.log(progress.value);
                //don't add attack time if attack stage finished
                if(aProgress.value > 0)progress.setValueAtTime(1, audioContext.currentTime + (aValue/1000));
                //recalculate decay progress ramp
                progress.linearRampToValueAtTime(0, audioContext.currentTime + (modValue / 1000));
                //re-calculate decay timing if decay stage unfinished
                this.decay(noteGroup.gainNode.gain, aValue, modValue);
            });
        });

        //console test code
        /*
        s.geS = 0.01
        function thing(){s.geD = 200}
        s.geD = 5000
        setTimeout(thing, 1000)
        */
    }

    get geS() {
        return this._geS;
    }

    set geS(value) {
        this._geS = value;
        let modNotes = this.getOnNoteIndexes();
        modNotes.forEach((note) => {
            this.noteOnList[note].forEach((noteGroup) => {
                let progress = noteGroup.envelopeProgress.decay;
                let aProgress = noteGroup.envelopeProgress.attack;
                //console.log(progress.value);
                //reset progress ramp
                //re-decay according to progress
                this.cancelAndHold(noteGroup.gainNode.gain);
                if(aProgress.value === 0)this.decay(noteGroup.gainNode.gain, this.geA * aProgress.value, this.geD * progress.value);
                else this.attack(noteGroup.gainNode.gain, this.geA * aProgress.value);
            });
        });
    }

    // ------------------------------- //

    // ----- Statistic Functions ----- //

    /**
     * Returns true/false if midi note value has voices in noteOn
     * @param {number} note
     * @return {boolean}
     */
    checkNoteOn(note){
        return (this.noteOnList[note] && this.noteOnList[note].length > 0);
    }

    /**
     * Returns true/false if midi note value has voices releasing
     * @param {number} note
     * @return {boolean}
     */
    checkNoteOff(note){
        return (this.noteOffList[note] && this.noteOffList[note].length > 0);
    }

    /**
     * Returns number of voices on/releasing on a midi note
     * @param {number} note
     * @return {{voicesOn: number, voicesReleasing: number}}
     */
    getNoteStatInfo(note){
        let onVoices = this.getOnNoteIndexes().length;
        let offVoices = this.getOffNoteIndexes().length;
        return {voicesOn: onVoices, voicesReleasing: offVoices};
    }

    /**
     * Takes a note index and parses voice info (# of on/releasing voices)
     * <br>Returns a user-readable string
     * @param {number} note
     */
    logNoteInfo(note){
        let info = this.getNoteStatInfo(note);
        let r = ("--------");
        r += ('\n# of voices on: ' + info.voicesOn);
        r += ('\n# of voices releasing: ' + info.voicesReleasing);
        r += ("\n--------");
        return r;
    }

    /**
     * Returns a user-readable string of active note voice info
     */
    logNotesSummary(){
        let r = ("--- Active Notes ---\n");
        for (let i = 0, l = 127; i <= l; i++){
            if( (this.checkNoteOn(i)) ||
                (this.checkNoteOff(i))) {
                r += ("\nNote: " + i);
                r += "\n" + this.logNoteInfo(i);
            }
        }
        r += ("\n\n--- End Summary ---");
        return r;
    }

    /**
     * Returns indexes for notes currently in noteOn state
     * @return {*[{index: {number}, voices: {number}]}
     */
    getOnNoteIndexes(){
        let r = [];
        for (let i in this.noteOnList){
            if(this.checkNoteOn(i)){
                r.push(i);
            }
        }
        return r;
    }

    /**
     * Returns indexes for notes currently in release state
     * @return {*[{index: {number}, voices: {number}]}
     */
    getOffNoteIndexes(){
        let r = [];
        for (let i in this.noteOffList){
            if(this.checkNoteOff(i)){
                r.push(i);
            }
        }
        return r;
    }

    /**
     * Returns both active and releasing soundOscillators of given midi note
     * <br>Return is an array:
     * <br>[0]: {note: midiNote, oscGroup: active soundOscillators[]}
     * <br>[1]: {note: midiNote oscGroup: releasing soundOscillators[]}
     * @param note
     */
    getAllOscillatorsOnNote(note){
        let r = [];
        if(this.checkNoteOn(note)) r[0] = {note: note, oscGroup: this.noteOnList[note]};
        if(this.checkNoteOff(note)) r[1] = {note: note, oscGroup: this.noteOffList[note]};
        return r;
    }


    // ------------------------------------ //

    // ---- Effect Insertion Functions ---- //
    //effect insertion currently not working afaik

    /**
     * Adds an insert effect to the Synthesizer and manages its connections
     * @param {AudioNode} a - AudioNode to insert as an effect for Synth
     */
    insertEffect(a) {
        this.effectList.push(a);
    }

    /**
     * Removes an insert effect at a given index and manages reconnections
     * @param i - index of effect in this.effectList
     */
    removeEffect(i) {
        let len = this.effectList.length;
        if (len > 0) {
            this.effectList[i].disconnect();
            this.effectList.splice(i, 1);
        } else {
            console.log('No insert effects present');
        }
    }

    /**
     * Reconnects effect at index to parent/child in effectList
     * @param i
     */
    reconnectEffect(i) {
        //if effect is the first effect, connects it to masterGainNode
        if (i === 0) {
            this.effectList[0].connect(masterGainNode);
        }
        let len = this.effectList.length;
        //asserts proper connects (like for reinsert of a node)
        if (len > i) { //checks if there is a node above it
            for (let i = 1, l = len; i < l; i++) {
                console.log('inserting..');
                this.effectList[i].connect(this.effectList[i - 1]); //connects node at i to node at i
                this.effectList[l].disconnect(); //disconnects node at index after i
                this.effectList[l].connect(this.effectList[i]); //connects l to node at index i
            }
        }
    }

    // ------------------------------------- //



    // -------- Getters and Setters ------- //

    get oscType() {
        return this._oscType;
    }

    set oscType(value) {
        this._oscType = value;
    }

    get destination() {
        return this._destination;
    }

    set destination(value) {
        this._destination = value;
    }

    get voices() {
        return this._voices;
    }

    set voices(value) {
        this._voices = value;
    }

    get detune() {
        return this._detune;
    }

    set detune(value) {
        this._detune = value;
    }

    get envelopeFilter() {
        return this._envelopeFilter;
    }

    set envelopeFilter(value) {
        this._envelopeFilter = value;
    }

    get feR() {
        return this._feR;
    }

    set feR(value) {
        this._feR = value;
    }

    get feS() {
        return this._feS;
    }

    set feS(value) {
        this._feS = value;
    }

    get feD() {
        return this._feD;
    }

    set feD(value) {
        this._feD = value;
    }

    get feA() {
        return this._feA;
    }

    set feA(value) {
        this._feA = value;
    }

    get feDepth() {
        return this._feDepth;
    }

    set feDepth(value) {
        this._feDepth = value;
    }

    get filterBandwidth() {
        return this._filterBandwidth;
    }

    set filterBandwidth(value) {
        this._filterBandwidth = value;
    }

    get filterFrequency() {
        return this._filterFrequency;
    }

    set filterFrequency(value) {
        this._filterFrequency = value;
    }

    get filterType() {
        return this._filterType;
    }

    set filterType(value) {
        this._filterType = value;
    }

    get geDepth() {
        return this._geDepth;
    }

    set geDepth(value) {
        this._geDepth = value;
    }

    get maxVolume() {
        return this._maxVolume;
    }

    set maxVolume(value) {
        this._maxVolume = value;
    }
}
