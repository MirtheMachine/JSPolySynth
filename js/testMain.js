/**
 * testMain.js
 * Written by Mirthe_
 *
 * Some spaghetti dynamic UI code to showcase intended usage of the synthesizer object.
 * UI creation starts with initializeAudio() which spawns the first question box
 * and fulfills the WebAudio API requirement for creating a
 * window.audioContext object in DOM from an eventListener function
 */

//IMPORTANT!!!! - must be initialized to window.audioContext by an event listener
let audioContext;
//Reference for synthesizer object to be created once params are gathered
let s;


let masterGainNode;
let note = 64;
let oldNote = 64;
let soundBtn;
let answers = [];
let boxes = [];

/**
 * Constructor template for a box object to be used by spawnBox function
 * <br>Question is the text for the container div
 * <br>Answers is an array of values for the select/option elements:
 * <br>{
 * <br> text: <text displayed in the option>,
 * <br> answer: <values for answers[] array to apply to synth>
 * <br> nextBox: <index of which box from boxes[] to spawn next>
 * <br>}
 * @returns {{question: string, answers: [{text: string, answer: string, nextBox: {number}}]}}
 * @constructor
 */
function Box() {
  return {
    question: "",
    answers: [{text: "", answer: "", nextBox: 0}],
  }
}

//starting box for tree
const firstQuestion = new Box();
firstQuestion.question = "What kind of oscillator would you like your Synthesizer to use? ";
firstQuestion.answers[0] = {text: "Sine", answer: "sine", nextBox: 0}
firstQuestion.answers.push({text : "Sawtooth", answer: "sawtooth", nextBox: 1});
firstQuestion.answers.push({text: "Square", answer: "square", nextBox: 2});

//voicing/detune question boxes
//answer format is "voices,detune"
const sineBox1 = new Box();
sineBox1.question = "What kind of sine tone? "
sineBox1.answers[0] = {text: "Single Sine", answer: "1,0", nextBox: 3};
sineBox1.answers.push({text: "Sub Bass", answer: "2,-1200", nextBox: 3});
sineBox1.answers.push({text: "Wobbly", answer: "3,100", nextBox: 3});

const sawBox1 = new Box();
sawBox1.question = "What kind of sawtooth tone? "
sawBox1.answers[0] = {text: "Super Saw!", answer: "4,10", nextBox: 3};
sawBox1.answers.push({text: "Cool Saw", answer: "2,20", nextBox: 3});
sawBox1.answers.push({text: "Sub Saw", answer: "2,-1200", nextBox: 3});

const squareBox1 = new Box();
squareBox1.question = "What kind of square tone? "
squareBox1.answers[0] = {text: "Squared Thirds", answer: "3,300", nextBox: 3};
squareBox1.answers.push({text: "Sub Square", answer: "2,-1200", nextBox: 3});
squareBox1.answers.push({text: "Single Square", answer: "1,0", nextBox: 3});

//answer format is gain envelope A,D,S,R values
const envelopeBox = new Box();
envelopeBox.question = "";
envelopeBox.answers[0] = {text: "Normal", answer: "100,100,0.5,500", nextBox: ""};
envelopeBox.answers.push({text: "Long Release", answer: "100,100,0.5,5000", nextBox: ""});
envelopeBox.answers.push({text: "Long Attack", answer: "1000,100,0.5,500", nextBox: ""});

boxes.push(sineBox1, sawBox1, squareBox1, envelopeBox);


function spawnBox(boxID) {
  if (answers.length < 2) {
    let box = boxID;
    const divContainer = document.createElement("div");
    const selectElement = document.createElement("select");
    selectElement.setAttribute("id", boxID);

    //add select element to divContainer
    divContainer.appendChild(document.createTextNode(box.question));


    //create option elements for each answer object in box
    box.answers.forEach(function (v) {
      const optionElement = document.createElement("option");
      optionElement.appendChild(document.createTextNode(v.text));
      //value is Synth Param Value:nextBox string
      optionElement.setAttribute("value", v.answer + ":" + v.nextBox);
      //append option to selectElement
      selectElement.appendChild(optionElement);
    });

    //create submit answer button
    const questionButton = document.createElement("input");
    questionButton.type = "button";
    questionButton.value = "submit answer";

    //add the event listener...
    questionButton.addEventListener("click", function () {
      //answer is taken from optionElement's value
      //let answer = this.parentNode.childNodes[1].value;
      let answer = selectElement.value;
      let answerValues = answer.split(":");
      //spawn a new Box based on selected option
      spawnBox(boxes[answerValues[1]]);
      //add answer value to answers[] global array for synth params to apply
      answers.push(answerValues[0]);

      //remove old question box by node reference
      document.body.removeChild(document.body.childNodes[5]);

      //on first answer, change the envelope question to match the selected oscillator
      if(answers.length === 1){
        envelopeBox.question = "What kind of envelope for your " + answerValues[0] + " oscillator? ";
      }
    }, {once: true});

    //append finished htmlElements/children to divContainer and add to body
    divContainer.appendChild(selectElement);
    divContainer.appendChild(questionButton);
    document.getElementsByTagName('body')[0].appendChild(divContainer);
  } else {
    //spawn the start synth button once looped through 3 times
    spawnStartAudioButton();
  }
}

function initializeAudio() {
  audioContext = new window.AudioContext();
  masterGainNode = audioContext.createGain();
  masterGainNode.gain.value = 0.75;
  console.log("audio started!");
  masterGainNode.connect(audioContext.destination);
  s = null;
  s = new Synthesizer(masterGainNode, 'sine', 'lowpass');
  document.getElementById("realFirstButton").onclick = null;
  document.getElementById("realFirstButton").remove();

  spawnBox(firstQuestion);
}

function spawnStartAudioButton() {
  const button = document.createElement("input");
  button.setAttribute("type", "button");
  button.setAttribute("id", "startAudioButton");
  button.setAttribute("value", "Start your Synth!");
  button.addEventListener("click", startSynth, {once: true});
  document.getElementsByTagName('body')[0].appendChild(button);
}

//Synth action functions
function changeNoteNumber() {
  //s.noteOff(oldNote);
  let i = document.getElementById("noteRangeSelector").value;
  note = i;
  oldNote = i;
  console.log("Midi note: " + i + " set.");
  document.getElementById(
      "noteText").textContent = "Midi note value for synth to play: " + i;
}

function changeParamValue(id, value) {
  let numParamSetters = [
    (v) => s.geA = parseInt(v),
    (v) => s.geD = parseInt(v),
    (v) => s.geS = parseFloat(v),
    (v) => s.geR = parseInt(v),
    (v) => s.voices = parseInt(v),
    (v) => s.detune = parseInt(v)
  ];
  document.getElementById(id + "Label").firstChild.nodeValue = value;
  id = parseInt(id.substring(1));
  numParamSetters[id](value);
  //console.log(id + ":" + value);
}




function startSynth() {
  document.getElementById('startAudioButton').remove();
  //set synth params
  s.oscType = answers[0];
  let voiceAnswers = answers[1].split(",");
  s.voices = parseInt(voiceAnswers[0]);
  s.detune = parseInt(voiceAnswers[1]);
  let envelopeAnswers = answers[2].split(",");
  s.geA = parseInt(envelopeAnswers[0]);
  s.geD = parseInt(envelopeAnswers[1]);
  s.geS = parseFloat(envelopeAnswers[2]);
  s.geR = parseInt(envelopeAnswers[3]);

  //add to accessible array with labels, range, and step
  const params = [s.geA, s.geD, s.geS, s.geR, s.voices, s.detune];
  const numParams = [
    {type: "attack", param: "geA", range: [0, 5000], step: 5},
    {type: "decay", param: "geD", range: [0, 5000], step: 5},
    {type: "sustain", param: "geS", range: [0.01, 1], step: 0.01},
    {type: "release", param: "geR", range: [0, 5000], step: 5},
    {type: "voices", param: "voices", range: [1, 6], step: 1},
    {type: "detune", param: "detune", range: [0, 1200], step: 5}
  ];
  //generate param control box
  const paramControlBox = document.createElement("div");
  for (let p = 0, l = numParams.length; p < l; p++){
    let container = document.createElement("div");
    let numSelect = document.createElement("input");
    let numSelectLabel = document.createElement("label");

    numSelect.setAttribute("type", "range");
    numSelect.setAttribute("name", "p"+ numParams[p].type);
    numSelect.setAttribute("min", numParams[p].range[0].toString());
    numSelect.setAttribute("max", numParams[p].range[1].toString());
    numSelect.setAttribute("step", numParams[p].step);
    numSelect.setAttribute("value", params[p]);
    numSelect.id = "p" + p;
    numSelect.addEventListener("change", function(e){
      changeParamValue(this.id, document.getElementById(this.id).value)
    });

    numSelectLabel.setAttribute("for", "p" + numParams[p].type);
    numSelectLabel.id = "p" + p + "Label";
    numSelectLabel.appendChild(document.createTextNode(params[p]));

    let paramText = document.createElement("p");
    paramText.appendChild(document.createTextNode(numParams[p].type));
    container.append(paramText, numSelect, numSelectLabel);
    paramControlBox.append(container);
  }

  const inputOn = document.createElement("input");
  const panicButton = document.createElement("input");
  const noteInputSlider = document.createElement("input");
  const helpTextDiv = document.createElement("div");

  inputOn.setAttribute("value", "Click/hold to play a note!");
  inputOn.setAttribute("type", "button");
  inputOn.setAttribute("id", "soundBtn");

  panicButton.setAttribute("value", "Stop all sound!");
  panicButton.setAttribute("type", "button");
  panicButton.setAttribute("id", "panicBtn");
  panicButton.setAttribute("onmousedown", "s.panic()");

  noteInputSlider.setAttribute("value", "64");
  noteInputSlider.setAttribute("type", "range");
  noteInputSlider.setAttribute("id", "noteRangeSelector");
  noteInputSlider.setAttribute("min", "20");
  noteInputSlider.setAttribute("max", "127");

  noteInputSlider.setAttribute("step", "1");
  helpTextDiv.appendChild(document.createTextNode("To change synthesizer parameters manually change with sliders above or press f12 to access the console:"));
  helpTextDiv.appendChild(document.createElement("br"));
  helpTextDiv.appendChild(document.createTextNode("List of commands:"))
  const helpTextList = document.createElement("ul");
  let commands = [
    "See summary of all note states in console: s.logNotesSummary()",
    "Oscillator Type: s.oscType = \"(sine,sawtooth,triangle,square)\"",
    "Voices per note: s.voices = {integer}",
    "Voice detune start value: s.detune = {cents}",
    "Gain Envelope Attack: s.geA = {time in ms}",
    "Gain Envelope Decay: s.geD = {time in ms}",
    "Gain Envelope Sustain: s.geS = {0.001 to 1.0}",
    "Gain Envelope Release: s.geR = {time in ms}",
    "Master filter type: s.filterType = \"{lowpass,highpass,lowshelf,etc.}\"",
    "Master filter cutoff frequency: s.filterFrequency = {value in hz}",
    "Master filter Q value: s.filterBandwidth = {resonance value in dB / Q value}"
  ];
  for (let c in commands){
    let li = document.createElement("li");
    li.appendChild(document.createTextNode(commands[c]));
    helpTextList.appendChild(li);
  }

  helpTextDiv.appendChild(helpTextList);

  inputOn.addEventListener("mousedown", playNote);
  inputOn.addEventListener("mouseup", stopNote);
  noteInputSlider.addEventListener("change", changeNoteNumber);
  document.getElementById("noteText").removeAttribute("hidden");

  const controlBox = document.createElement("div");
  controlBox.append(inputOn, panicButton, noteInputSlider);

  document.body.append(controlBox, document.createElement("br"), paramControlBox, helpTextDiv);
}

function playNote() {
  s.noteOn(note);
}

function stopNote() {
  s.noteOff(note);
}
