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

        let createdOsc;
        if (this.noteOnList[note]) {
            //pushes a new soundOscillator (can have a soundOscillator releasing on the same note)
            let si = this.noteOnList[note].push(createSOsc(this._voices, this._detune, this._oscType, this._maxVolume, noteFreq(note),
                this._filterType, this._filterFrequency, this._filterBandwidth));
            //sets s to newly created oscillator on note
            createdOsc = this.noteOnList[note][si - 1];
        } else {
            //sets noteList[note] to a standard soundOscillator array with a singular soundOscillator
            this.noteOnList[note] = [createSOsc(this._voices, this._detune,
                this._oscType, this._maxVolume, noteFreq(note),
                this._filterType, this._filterFrequency, this._filterBandwidth)];
            //sets s to index 0 (the created SoundOscillator) on created array in note
            createdOsc = this.noteOnList[note][0];
        }
        //Log voice creation
        //console.log("Voice created on note: " + note);
        //this.logNoteInfo(note);

        //initialize new soundOscillator gain volume for enveloping
        const newOSCParam = createdOsc.gainNode.gain;
        newOSCParam.cancelScheduledValues(0);
        newOSCParam.exponentialRampToValueAtTime(0.001, 0);

        //assign new soundOscillator a constant reference
        const newOSC = createdOsc;

        //get values of CSC envelope progress nodes
        const attackProgress = newOSC.envelopeProgress.attack;
        const decayProgress = newOSC.envelopeProgress.decay;

        //connect 'master' soundOscillator node to synthesizer's destination
        newOSC.filterNode.connect(this._destination);

        //schedule attack/decay
        newOSCParam.exponentialRampToValueAtTime(.993, audioContext.currentTime + (this.geA / 1000));
        newOSCParam.linearRampToValueAtTime(this.geS, audioContext.currentTime + ((this.geA+this.geD) / 1000));

        //schedule attack/decay progress timers
        attackProgress.linearRampToValueAtTime(0, audioContext.currentTime + (this.geA/1000));
        decayProgress.linearRampToValueAtTime(1, audioContext.currentTime + (this.geA/1000));
        decayProgress.linearRampToValueAtTime(0, audioContext.currentTime + (this.geD/1000));
    }

    /**
     * Triggers a release envelope for least recent soundOscillator on given note
     * <br> * Changes gain value to 0.001% over this.geR milliseconds
     * <br> * Exchanges soundOscillator from noteOnList to noteOffList
     * <br> * Sets a timeout to delete the enveloped soundOscillator from noteOffList after release period
     * <br> * NOTE: Thank you to Jake (Ozzy64k) for never leaving my brain until I got this right
     * @param {number} note Midi note value
     */
    noteOff(note) {
        if (note in this.noteOnList && this.noteOnList[note].length > 0) {
            let oscIndex = this.noteOnList[note].length - 1;
            let oscParam = this.noteOnList[note][oscIndex].gainNode.gain;

            //cancel and hold old value - have to use because firefox doesn't support cancelAndHoldAtTime
            let oldValue = oscParam.value;
            oscParam.cancelScheduledValues(0);
            //set oscParam value from changing to on hold
            oscParam.exponentialRampToValueAtTime(oldValue, audioContext.currentTime + 0.001); //causes a small 'pop' due to immediate change

            //ramp oscParam value to near 0 after this.geR milliseconds
            oscParam.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + (this.geR / 1000));
            //oscParam.setValueAtTime(0.0001, audioContext.currentTime + (this.geR / 1000));

            //exchange oscillator from noteOnList to noteOffList
            if(note in this.noteOffList)this.noteOffList[note].push(this.noteOnList[note].pop());
            else this.noteOffList[note] = [this.noteOnList[note].pop()];

            //console.log(this.noteOffList[note][this.noteOffList[note].length-1].envelopeProgress.release.value);

            //schedule release progress timer
            this.noteOffList[note][this.noteOffList[note].length-1].envelopeProgress.release.setValueAtTime(1, 0);
            this.noteOffList[note][this.noteOffList[note].length-1].envelopeProgress.release.linearRampToValueAtTime(0, audioContext.currentTime + (this.geR / 1000));

            //create timeOut with delay of this.geR and push id to timeOutList
            //timeOut function stops and removes soundOscillator from offList[note] + deletes its ID from the timeOutList
            this.timeOutList.push(setTimeout( (offList, note, timeOutList) => {
                if(offList[note]){
                    offList[note][0].oscillators.forEach((osc) => {
                        osc.stop(0);
                    });
                    offList[note].splice(0, 1);
                    //memory management below not required
                    //if(offList[note].length === 0) offList.splice(note, 1);
                    //if(noteList[note] && noteList[note].length === 0) noteList.splice(note, 1);
                    timeOutList.splice(0, 1);
                }
            }, this.geR, this.noteOffList, note, this.timeOutList));

            //Log voice releasing
            /**
            this.timeOutList.push(setTimeout((note) => {
                    console.log("Voice stopped on note: " + note);
                    this.logNoteInfo(note);
                }, this.geR, note));
             */
        }
    }

    /**
     * Deletes all oscillators in lists + clears all note release timeouts
     */
    panic() {
        for (let i = 0, l = this.noteOnList.length; i < l; i++){
            if(i in this.noteOnList && this.noteOnList[i].length > 0){
                this.noteOnList[i].forEach((soundOscillator) => {
                    soundOscillator.oscillators.forEach((osc) => {osc.stop(0)});
                });
                this.noteOnList[i].splice(0);
                console.log("Stopped all running sound on note: " + i);
            }
        }
        for (let i = 0, l = this.noteOffList.length; i < l; i++){
            if(i in this.noteOffList && this.noteOffList[i].length > 0){
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
        this.timeOutList.splice(0);
        let modNotes = [];
        for (let note in this.noteOffList){
            if (this.noteOffList[note] && this.noteOffList[note].length > 0){
                //log notes modified by new release
                //console.log(note);
                modNotes.push(this.noteOffList[note]);
            }
        }
        modNotes.forEach((noteGroup) => {
            noteGroup.forEach((soundOscillator) => {
                //STINKY REPEATED CODE (almost).
                //New release time is scaled by note release progress
                //Note release progress is a value linearly changing from 1 to 0
                let p = soundOscillator.envelopeProgress.release.value;
                //log progress value
                //console.log(p);

                //cancel and hold old value - have to use because firefox doesn't support cancelAndHoldAtTime
                let oldValue = soundOscillator.gainNode.gain.value;

                soundOscillator.gainNode.gain.cancelScheduledValues(0);
                //set oscParam value from changing to on hold
                soundOscillator.gainNode.gain.exponentialRampToValueAtTime(oldValue, audioContext.currentTime + 0.001); //causes a small 'pop' due to immediate change

                soundOscillator.gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + ((newRelease*p)/1000));
                //soundOscillator.gainNode.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + ((newRelease*p)/1000));

                //create timeOut with delay of this.geR and push id to timeOutList
                //timeOut function stops and removes soundOscillator from offList[note] + deletes its ID from the timeOutList
                this.timeOutList.push(setTimeout( (offList, note, timeOutList) => {
                    if(offList[note]){
                        offList[note][0].oscillators.forEach((osc) => {
                            osc.stop(0);
                        });
                        offList[note].splice(0, 1);
                        //memory management below not required
                        //if(offList[note].length === 0) offList.splice(note, 1);
                        //if(noteList[note] && noteList[note].length === 0) noteList.splice(note, 1);
                        timeOutList.splice(0, 1);
                    }
                }, newRelease*p, this.noteOffList, noteGroup, this.timeOutList));

                let oldProgressValue = soundOscillator.envelopeProgress.release.value;
                soundOscillator.envelopeProgress.release.cancelScheduledValues(0);
                soundOscillator.envelopeProgress.release.linearRampToValueAtTime(oldProgressValue, 0.001);
                soundOscillator.envelopeProgress.release.linearRampToValueAtTime(0, audioContext.currentTime + ((newRelease*p)/1000));
            });
        });
    }

    // ------------------------------- //

    // ----- Statistic Functions ----- //

    /**
     * Returns both active and releasing soundOscillators of given midi note
     * <br>Return is an array:
     * <br>[0]: {note: midiNote, oscGroup: active soundOscillators[]}
     * <br>[1]: {note: midiNote oscGroup: releasing soundOscillators[]}
     * @param note
     */
    getNoteOscillators(note){
        let r = [];
        if(this.noteOnList[note] && this.noteOnList[note].length > 0) r[0] = {note: note, oscGroup: this.noteOnList[note]};
        if(this.noteOffList[note] && this.noteOffList[note].length > 0) r[1] = {note: note, oscGroup: this.noteOffList[note]};
        return r;
    }

    /**
     * Returns number of voices on/releasing on a midi note
     * @param {number} note
     * @return {{voicesOn: {number}, voicesReleasing: {number}}}
     */
    getNoteInfo(note){
        let onVoices = (this.noteOnList[note] && this.noteOnList[note].length > 0) ? this.noteOnList[note].length: 0;
        let offVoices = (this.noteOffList[note] && this.noteOffList[note].length > 0) ? this.noteOffList[note].length: 0;
        return {voicesOn: onVoices, voicesReleasing: offVoices};
    }

    /**
     * Takes a note index and parses voice info (# of on/releasing voices)
     * <br>Returns a user-readable string
     * @param {number} note
     */
    logNoteInfo(note){
        let info = this.getNoteInfo(note);
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
            if( (this.noteOnList[i] && this.noteOnList[i].length > 0) ||
                (this.noteOffList[i] && this.noteOffList[i].length > 0)) {
                r += ("\nNote: " + i);
                r += "\n" + this.logNoteInfo(i);
            }
        }
        r += ("\n\n--- End Summary ---");
        return r;
    }

    /**
     * Returns data for notes currently in noteOn state
     * @return {{index: {number}, voices: {number}}[]}
     */
    getOnNoteInfo(){
        let r = [];
        for (let i in this.noteOnList){
            if(this.noteOnList[i] && this.noteOnList[i].length > 0){
                r.push(this.getNoteInfo(i));
            }
        }
        return r;
    }

    /**
     * Returns data for notes currently in release state
     * @return {*[{index: {number}, voices: {number}]}
     */
    getOffNoteInfo(){
        let r = [];
        for (let i in this.noteOffList){
            if(this.noteOffList[i] && this.noteOffList[i].length > 0){
                r.push(this.getNoteInfo(i));
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
            if(this.noteOffList[i] && this.noteOffList[i].length > 0){
                r.push(i);
            }
        }
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



    get geS() {
        return this._geS;
    }

    set geS(value) {
        this._geS = value;
    }

    get geD() {
        return this._geD;
    }

    set geD(value) {
        this._geD = value;
    }

    get geA() {
        return this._geA;
    }

    set geA(value) {
        this._geA = value;
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
