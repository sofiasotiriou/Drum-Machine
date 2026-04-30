import {Sequencer} from "./sequencer.js";


const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const buffers = {};

const hhbuttons = document.querySelectorAll(".hihat-drums");  
const kbuttons = document.querySelectorAll(".kick-drums");    
const sbuttons = document.querySelectorAll(".snare-drums");   
const tbuttons = document.querySelectorAll(".tom-drums");     

const sequencer = new Sequencer(audioContext, playSound);

const startstop = document.getElementById("ss");
const upBPM = document.getElementById("upBPM");
const downBPM = document.getElementById("downBPM");


window.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: true });

async function loadAudio(soundName, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP issue status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers[soundName] = audioBuffer;
    } catch (error) {
        console.error(`Error loading ${soundName}:`, error);
    }
}

loadAudio('hihat', './sounds/hihat.wav');
loadAudio('kick', './sounds/kick.wav');
loadAudio('snare', './sounds/snare.wav');
loadAudio('tom', './sounds/tom.wav');


function playSound(soundName, time = 0) {
    const buffer = buffers[soundName];
    
    if (!buffer) {
        console.error(`${soundName} not loaded`);
        return;
    }
    
    // Suspended AudioContext
    if (audioContext.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        audioContext.resume().then(() => {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(time);
        });
        return;
    }
    
    // Normal playback with scheduled time
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(time);
}


hhbuttons.forEach(button => {
    button.addEventListener("mousedown", (e) => {
        const buttonIndex = e.target.dataset.buttonIndex;
        playSound('hihat')
        sequencer.setHihat(buttonIndex-1)
        console.log(sequencer.hihat)
    });
});

kbuttons.forEach(button => {
    button.addEventListener("mousedown", (e) => {
        const buttonIndex = e.target.dataset.buttonIndex;
        playSound('kick')
        sequencer.setKick(buttonIndex-1)
        console.log(sequencer.kick)
    });
});

sbuttons.forEach(button => {
    button.addEventListener("mousedown", (e) => {
        const buttonIndex = e.target.dataset.buttonIndex;
        playSound('snare')
        sequencer.setSnare(buttonIndex-1)
        console.log(sequencer.snare)
    });
});

tbuttons.forEach(button => {
    button.addEventListener("mousedown", (e) => {
        const buttonIndex = e.target.dataset.buttonIndex;
        playSound('tom')
        sequencer.setTom(buttonIndex-1)
        console.log(sequencer.tom)
    });
});


startstop.addEventListener("mousedown", () => {
    if (sequencer.playing == false) {      
        sequencer.start();
    } else {        
        sequencer.stop();
    }
});

upBPM.addEventListener("mousedown", () => sequencer.upBPM());
downBPM.addEventListener("mousedown", () => sequencer.downBPM());

