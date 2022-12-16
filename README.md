# Javascript Poly Synth
A WIP demonstration of creating a polyphonic synthesizer in Javascript via the Web Audio API

-----------------------
# General Usage

* Clone/download repository files (use the green 'code' button at the top and download/extract the zip!)
* Double click index.html or open in Firefox/Chrome/Edge/Safari (most browsers supported)
* Click the first button to initialize the audio and start generating your synthesizer
* Navigate through the options to initialize a synthesizer through a tree of preset values
* Start the synthesizer via the onscreen button that appears once finished
    Use the slider on the right to change the midi note (value updates in text above)
* Click/hold the left button to make sound!


### Cool Tips:

* The "click/hold" button acts like a key on a piano! Hold the button and try setting different envelope values for fun results.
* The "Stop all sound" button acts as an instant panic - it deletes all currently running voices/oscillators.
* The button's mousedown/mouseup actions are noteOn/noteOff meaning..
* To hold a voice on a note: Click and hold over the button -> keep click held -> move mouse off of button
* To un-hold a voice on a note: Hold down click -> move cursor onto button -> release click
* Try doing some addition/subtraction of voices on a note doing the above to test the synth's dynamic polyphony
* A single note can have multiple types of oscillators playing! Set a note to be held then change oscillator type and play some new ones! See what happens :)

-----------------------

# Use in Your Page!

### Add the following to your html header with corresponding files in directory:
```html
<script src="js/soundOscillator.js"/>
<script src="js/synthesizer.js"/>
```

### Have the following variable in your main script in global scope
```js
let audioContext; //global scope
//create Synthesizer object later in scope
```

## IMPORTANT:
### Initialize it with an event listener:
```js
//function for event listener/mousedown action
function initializeAudio() {
    // initalize audioContext
    audioContext = new window.AudioContext();
    // optional: remove start audio button from screen
    button.remove();
    // you may now initialize a Synthesizer object
}

// -- Example of generating HTML button/event listener -- //

// create the button HTMLElement object
const button = document.createElement('button');

// add the event listener pass through reference to self to delete once done
button.addEventListener('mousedown', initializeAudio(), {once: true});

// add button to the body/intended parent node
document.body.appendChild(button);
```

### Create your synthesizer (destination can be any node!)
```js
let s;

// function called once synth params gathered
function startSynth(){
    // initialize Synthesizer with a destination
    // constructor overload: Synthesizer(destination, oscType, filterType)
    s = new Synthesizer(audioContext);
    // set Synthesizer params example - setting envelope release to 1 second
    s.geR = 1000;
}
```
-----------------------

