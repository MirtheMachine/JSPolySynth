/**
 * soundOscillator.js
 * <br>Written by Mirthe_
 *
 * <br>SoundOscillator constructor and createOscillator function
 * <br>Requires audioContext<window.audioContext> object in global scope
 */
class SoundOscillator {
    /**
     * Represents an oscillator with gainNode and filterNode
     * @param {number} voices
     * @param {number} detune
     * @param {"synth"|"sampler"} type
     * @constructor
     */
    constructor(voices = 1, detune = 0, type = "synth") { //to-do new params: oType, oVol, frequency, effects

        this.voices = voices;
        this.detune = detune;
        this.oscillators = [];

        this.setType(type);

        this.samples = [];

        /** @type {GainNode} */
        this.gainNode = audioContext.createGain();

        /** @type {BiquadFilterNode} */
        this.filterNode = audioContext.createBiquadFilter();

        /** @type {number} */
        this.maxOscVol = 1; //want to be able to decrease oscillator volume based on if there's more than one
    }

    /**
     * Sets oscillators type
     * @param {"synth" | "sampler"} type
     */
    setType(type = "synth"){
        const oscillators = [];
        if(type === "synth"){
            let evens = 1;
            for(let i = 0; i < this.voices; i ++){
                let osc = audioContext.createOscillator();
                if(i>0){
                    if(i%2===1)osc.detune.value = this.detune * evens;
                    else{
                        osc.detune.value = this.detune * -evens;
                        evens++;
                    }
                }
                oscillators.push(osc);
            }
        }
        else{
            //TO-DO: create audioBuffer nodes based on file
        }

        this.oscillators = oscillators;
    }

    async getFile(audioContext, filepath) {
        const response = await fetch(filepath);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    }


}

/**
 * Creates and initializes a new oscillator with proper context connections
 * @param {number} voices
 * @param {number} detune
 * @param {"sine" | "square" | "triangle" | "sawtooth" | "custom" } oType - oscillator type
 * @param {number} oVol max gain for envelope
 * @param {number} frequency frequency for oscillator to play at [float:hz]
 * @param {"allpass" | "bandpass" | "highpass" | "highshelf" | "lowpass" | "lowshelf" | "notch" | "peaking"} fType  biquad filter type
 * @param {number} fFrequency base filter frequency [float:hz]
 * @param {number} fQValue bandwidth in octaves to be converted to Q value for filter
 * @returns {SoundOscillator} a new SoundOscillator created with given params and connected to the master audio context
 */
function createSOsc(voices = 1, detune = 0,
    oType = "sine", oVol= 1, frequency,
    fType= "lowpass", fFrequency = 24000, fQValue)
{
    const o = new SoundOscillator(voices, detune);

    o.oscillators.forEach((osc) => {osc.type = oType});
    o.oscillators.forEach((osc) => {osc.frequency.value = frequency});
    o.filterNode.type = fType;
    o.filterNode.frequency.value = fFrequency;
    o.filterNode.Q.value = fQValue;

    o.gainNode.gain.value = 0.001;
    o.maxOscVol = oVol; //to be used for anti-clip later on

    o.oscillators.forEach((osc) => {osc.connect(o.gainNode)});
    o.gainNode.connect(o.filterNode);

    o.oscillators.forEach((osc) => {osc.start(0)});

    return o;
}
