# JavascriptPolySynth
A WIP demonstration of creating a polyphonic synthesizer in Javascript via the Web Audio API

-----------------------
# General Usage
* Clone/download repository files (use the green 'code' button at the top and download as a zip!)
* Double click index.html or open in Firefox/Chrome/Edge/Safari (most browsers supported)
* Click the first button to initialize the audio and start generating your synthesizer
* Navigate through the options to initialize a synthesizer through a tree of preset values
* Start the synthesizer via the onscreen button that appears once finished
* Use the slider on the right to change the midi note (value updates in text above)
* Click the first button to make sound!

### Tips:
* The "click/hold" button acts like a key on a piano! Hold the button and try setting different envelope values for fun results.
* The "Stop all sound" button acts as an instant panic - it deletes all currently running voices/oscillators.
* The button's mousedown/mouseup actions are noteOn/noteOff. You can click down and drag off the button to hold the note (don't release click until cursor off of button)
* If a note gets stuck, you can do the inverse of the above, hold down click -> move cursor onto button -> release click, to untrigger a stuck voice. Try doing some voice math and add/subtract voices per-note :)
-----------------------
# Use in Your Page!

### Add the following to your html header with corresponding files in directory:
```html
<script src="js/soundOscillator.js"></script>
<script src="js/synthesizer.js"></script>
```

### Have the following variable in your main script in global scope
```js
let audioContext; //global scope
//create Synthesizer object later in scope
```

## IMPORTANT:
### Initialize it with an event listener:
```js
function initializeAudio() {
  audioContext = new window.AudioContext();
  //spawn UI to handle gathering synth params
}
```

### Create your synthesizer (destination can be any node!)
```js
let s;

//function called once synth params gathered
function startSynth(){
  s = new Synthesizer(audioContext);
  //set Synthesizer params
}
-----------------------
