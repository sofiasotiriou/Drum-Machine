import { Sequencer } from "./sequencer.js";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const buffers = {};
const tracks = ["kick", "snare", "hihat", "tom"];
const activeSources = [];

const defaultPattern = length => ({
  length,
  kick: Array(length).fill(0),
  snare: Array(length).fill(0),
  hihat: Array(length).fill(0),
  tom: Array(length).fill(0)
});

let patterns = {
  A: {
    length: 8,
    kick: [1, 1, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [0, 1, 1, 1, 0, 1, 1, 1],
    tom: [0, 0, 0, 1, 0, 1, 1, 1]
  },
  B:{
    length: 8,
    kick: [1, 1, 0, 1, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 1],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
    tom: [0, 0, 0, 0, 0, 0, 0, 0]
  },
  C: {
    length: 8,
    kick: [1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 1],
    hihat: [0, 1, 0, 1, 0, 1, 0, 1],
    tom: [0, 1, 0, 0, 0, 0, 0, 1]
  },
  D: {
    length: 8,
    kick: [1, 0, 0, 0, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [0, 1, 0, 1, 0, 1, 0, 1],
    tom: [0, 0, 0, 1, 0, 0, 0, 0]
  }
};

let currentPattern = "A";
let copiedPattern = null;
let songOrder = [];
let songPlaying = false;
let songPatternIndex = 0;

const effects = {
  delay: 0,
  reverb: 0, 
  distortion: 0,
  compressor: -24,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0
};

const customSamples = new Map();
const sampleSettings = {
  kick: { volume: 100, pitch: 1, reverse: false },
  snare: { volume: 100, pitch: 1, reverse: false },
  hihat: { volume: 100, pitch: 1, reverse: false },
  tom: { volume: 100, pitch: 1, reverse: false }
};

// =======================
// AUDIO EFFECTS SETUP
// =======================

const masterGain = audioContext.createGain();

const lowEQ = audioContext.createBiquadFilter();
lowEQ.type = "lowshelf";
lowEQ.frequency.value = 320;

const midEQ = audioContext.createBiquadFilter();
midEQ.type = "peaking";
midEQ.frequency.value = 1000;
midEQ.Q.value = 1;

const highEQ = audioContext.createBiquadFilter();
highEQ.type = "highshelf";
highEQ.frequency.value = 3200;

const compressor = audioContext.createDynamicsCompressor();

const delayNode = audioContext.createDelay();
delayNode.delayTime.value = 0.25;

const delayFeedback = audioContext.createGain();
delayFeedback.gain.value = 0;

const delayWet = audioContext.createGain();
delayWet.gain.value = 0;

const reverbNode = audioContext.createConvolver();
const reverbGain = audioContext.createGain();
reverbGain.gain.value = 0;
const dryGain = audioContext.createGain();
dryGain.gain.value = 1;

const distortionNode = audioContext.createWaveShaper();
const distortionGain = audioContext.createGain();
distortionGain.gain.value = 0;

async function createReverbImpulse(duration = 2, decay = 2) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  
  reverbNode.buffer = impulse;
}
createReverbImpulse(2, 2);

function createDistortionCurve(amount) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

distortionNode.curve = createDistortionCurve(0);
distortionNode.oversample = '4x';


// =======================
// AUDIO ROUTING
// =======================

masterGain.connect(lowEQ);
lowEQ.connect(midEQ);
midEQ.connect(highEQ);
highEQ.connect(compressor);

compressor.connect(dryGain);
compressor.connect(reverbGain);

reverbGain.connect(reverbNode);
reverbNode.connect(distortionGain);
distortionGain.connect(distortionNode);
distortionNode.connect(audioContext.destination);

dryGain.connect(audioContext.destination);

highEQ.connect(delayNode);
delayNode.connect(delayFeedback);
delayFeedback.connect(delayNode);
delayNode.connect(delayWet);
delayWet.connect(audioContext.destination);


// =======================
// DOM ELEMENTS
// =======================

const sequencerGrid = document.getElementById("sequencerGrid");
const beatVisualiser = document.getElementById("beatVisualiser");
const startStop = document.getElementById("ss");
const bpmSlider = document.getElementById("bpmSlider");
const bpmValue = document.getElementById("bpmValue");
const swingSlider = document.getElementById("swingSlider");
const swingValue = document.getElementById("swingValue");
const patternLength = document.getElementById("patternLength");
const autosaveStatus = document.getElementById("autosaveStatus");
const dropZone = document.getElementById('dropZone');
const sampleUpload = document.getElementById('sampleUpload');
const uploadBtn = document.getElementById('uploadBtn');
const sampleList = document.getElementById('sampleList');
const sampleEditor = document.getElementById('sampleEditor');
const editSampleSelect = document.getElementById('editSampleSelect');
const sampleVolume = document.getElementById('sampleVolume');
const volumeValue = document.getElementById('volumeValue');
const samplePitch = document.getElementById('samplePitch');
const pitchValue = document.getElementById('pitchValue');
const sampleReverse = document.getElementById('sampleReverse');
const saveSampleSettings = document.getElementById('saveSampleSettings');
const resetSample = document.getElementById('resetSample');
const playTestSample = document.getElementById('playTestSample');


// =======================
// SEQUENCER INITIALIZATION
// =======================

const sequencer = new Sequencer(audioContext, playSound, updateBeatVisualiser);
sequencer.setPattern(patterns[currentPattern]);

window.addEventListener("click", () => {
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}, { once: true });


// =======================
// AUDIO LOADING
// =======================

async function loadAudio(soundName, url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    buffers[soundName] = await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error(`Error loading ${soundName}:`, error);
  }
}

loadAudio("hihat", "./sounds/hihat.wav");
loadAudio("kick", "./sounds/kick.wav");
loadAudio("snare", "./sounds/snare.wav");
loadAudio("tom", "./sounds/tom.wav");


// =======================
// PLAY SOUND
// =======================

function playSound(soundName, time = 0) {
  const buffer = buffers[soundName];

  if (!buffer) {
    console.error(`${soundName} not loaded`);
    return;
  }

  const settings = sampleSettings[soundName];
  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();

  source.playbackRate.value = settings.pitch;
  gainNode.gain.value = settings.volume / 100;

  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(masterGain);

  activeSources.push(source);

  source.onended = () => {
    const index = activeSources.indexOf(source);
    if (index !== -1) {
      activeSources.splice(index, 1);
    }
  };

  source.start(time);
  triggerMeter(soundName);
}


// =======================
// UPDATE AUDIO EFFECTS
// =======================

function updateAudioEffects() {
  delayWet.gain.value = effects.delay;
  delayFeedback.gain.value = effects.delay * 0.6;

  compressor.threshold.value = effects.compressor;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  lowEQ.gain.value = effects.eqLow;
  midEQ.gain.value = effects.eqMid;
  highEQ.gain.value = effects.eqHigh;
  
  reverbGain.gain.value = effects.reverb;
  dryGain.gain.value = 1 - effects.reverb;
  
  if (effects.distortion > 0) {
    distortionNode.curve = createDistortionCurve(effects.distortion);
    distortionGain.gain.value = 1;
  } else {
    distortionGain.gain.value = 0;
  }
}


// =======================
// STOP ALL AUDIO
// =======================

function stopAllSounds() {
  activeSources.forEach(source => {
    try {
      source.stop();
    } catch (error) {
      console.warn("Source already stopped");
    }
  });

  activeSources.length = 0;
}


// =======================
// SPECTRUM METER
// =======================

function triggerMeter(soundName) {
  const meter = document.getElementById(`meter-${soundName}`);

  if (!meter) return;

  meter.style.width = "100%";

  setTimeout(() => {
    meter.style.width = "0%";
  }, 120);
}


// =======================
// SEQUENCER GRID
// =======================

function renderGrid() {
  const pattern = patterns[currentPattern];

  sequencerGrid.innerHTML = "";
  beatVisualiser.innerHTML = "";

  document.documentElement.style.setProperty("--steps", pattern.length);
  sequencerGrid.style.setProperty("--steps", pattern.length);
  beatVisualiser.style.setProperty("--steps", pattern.length);

  for (let i = 0; i < pattern.length; i++) {
    const dot = document.createElement("div");

    dot.className = "beat-dot";
    dot.dataset.step = i;

    beatVisualiser.appendChild(dot);
  }

  tracks.forEach(track => {
    const row = document.createElement("div");

    row.className = "row";
    row.style.setProperty("--steps", pattern.length);

    const label = document.createElement("div");

    label.className = "row-label";
    label.textContent = track.toUpperCase();

    row.appendChild(label);

    for (let step = 0; step < pattern.length; step++) {

      const button = document.createElement("button");

      button.className = "step";
      button.dataset.track = track;
      button.dataset.step = step;

      if (pattern[track][step] === 1) {
        button.classList.add("active");
      }

      button.addEventListener("mousedown", () => {
        pattern[track][step] = pattern[track][step] === 1 ? 0 : 1;
        sequencer.setPattern(pattern);
        button.classList.toggle("active");

        playSound(track);
        autosave();
      });

      row.appendChild(button);
    }

    sequencerGrid.appendChild(row);
  });
}


// =======================
// BEAT VISUALISER
// =======================

function updateBeatVisualiser(step) {
  document.querySelectorAll(".beat-dot").forEach(dot => {
    dot.classList.toggle("active", Number(dot.dataset.step) === step);
  });

  document.querySelectorAll(".step").forEach(button => {
    button.classList.toggle("playing", Number(button.dataset.step) === step);
  });

  if (
    songPlaying &&
    step === patterns[currentPattern].length - 1
  ) {
    setTimeout(() => {
      goToNextSongPattern();
    }, 0);
  }
}


// =======================
// START/STOP CONTROLS
// =======================

startStop.addEventListener("click", () => {
  if (!sequencer.playing) {
    songPlaying = false;
    sequencer.start();
    startStop.textContent = "Stop";
    document.getElementById("playSong").textContent = "Play Song";
  } else {
    songPlaying = false;
    sequencer.stop();
    stopAllSounds();
    startStop.textContent = "Play";
    document.getElementById("playSong").textContent = "Play Song";
  }
});

document.getElementById("resetProject").addEventListener("click", () => {
  resetProject();
});


// =======================
// BPM/SWING CONTROLS
// =======================

bpmSlider.addEventListener("input", () => {
  sequencer.bpm = Number(bpmSlider.value);
  bpmValue.textContent = bpmSlider.value;
  autosave();
});

swingSlider.addEventListener("input", () => {
  sequencer.swing = Number(swingSlider.value);
  swingValue.textContent = `${swingSlider.value}%`;
  autosave();
});


// =======================
// PATTERN CONTROLS
// =======================

document.querySelectorAll(".pattern-btn").forEach(button => {
  button.addEventListener("click", () => {
    patterns[currentPattern] = sequencer.getPattern();
    currentPattern = button.dataset.pattern;

    sequencer.setPattern(patterns[currentPattern]);
    patternLength.value = patterns[currentPattern].length;

    document.querySelectorAll(".pattern-btn").forEach(btn => {
      btn.classList.remove("active");
    });

    button.classList.add("active");

    renderGrid();
    autosave();
  });
});

patternLength.addEventListener("change", () => {
  const newLength = Number(patternLength.value);
  const oldPattern = patterns[currentPattern];
  const newPattern = defaultPattern(newLength);

  if (oldPattern.length == 8 && newLength == 16) {
    tracks.forEach(track => {
      for (let i = 0; i < 8; i++) {
        newPattern[track][i] = oldPattern[track][i];
        newPattern[track][i+8] = oldPattern[track][i];
      }
    });
  } else if (oldPattern.length == 16 && newLength == 8) {
    tracks.forEach(track => {
      for (let i = 0; i < 8; i++) {
        newPattern[track][i] = oldPattern[track][i];
      }
    });
  } else {
    tracks.forEach(track => {
      for (let i = 0; i < newLength; i++) {
        newPattern[track][i] = oldPattern[track][i];
      }
    });
  }
  patterns[currentPattern] = newPattern;
  sequencer.setPattern(newPattern);

  renderGrid();
  autosave();
});

document.getElementById("copyPattern").addEventListener("click", () => {
  copiedPattern = JSON.parse(JSON.stringify(patterns[currentPattern]));
});

document.getElementById("pastePattern").addEventListener("click", () => {
  if (!copiedPattern) return;

  patterns[currentPattern] = JSON.parse(JSON.stringify(copiedPattern));

  sequencer.setPattern(patterns[currentPattern]);
  patternLength.value = patterns[currentPattern].length;

  renderGrid();
  autosave();
});

document.getElementById("clearPattern").addEventListener("click", () => {
  patterns[currentPattern] = defaultPattern(patterns[currentPattern].length);

  sequencer.setPattern(patterns[currentPattern]);

  renderGrid();
  autosave();
});


// =======================
// SONG MODE CONTROLS
// =======================

document.getElementById("addToSong").addEventListener("click", () => {
  const selected = document.getElementById("songPatternSelect").value;

  songOrder.push(selected);

  renderSongOrder();
  autosave();
});

document.getElementById("clearSong").addEventListener("click", () => {
  songOrder = [];

  renderSongOrder();
  autosave();
});

document.getElementById("playSong").addEventListener("click", () => {
  if (!songPlaying) {
    startSongMode();
  } else {
    stopSongMode();
  }
});

function renderSongOrder() {
  const container = document.getElementById("songOrder");

  container.innerHTML = "";

  songOrder.forEach((patternName, index) => {
    const item = document.createElement("div");

    item.className = "song-item";
    item.textContent = patternName;

    item.addEventListener("click", () => {
      songOrder.splice(index, 1);
      renderSongOrder();
      autosave();
    });

    container.appendChild(item);
  });
}

function startSongMode() {
  if (songOrder.length === 0) {
    alert("Add at least one pattern to Song Mode first.");
    return;
  }

  songPlaying = true;
  songPatternIndex = 0;

  loadSongPattern(songOrder[songPatternIndex]);

  sequencer.start();

  startStop.textContent = "Stop";
  document.getElementById("playSong").textContent = "Stop Song";
}

function stopSongMode() {
  songPlaying = false;
  songPatternIndex = 0;

  sequencer.stop();
  stopAllSounds();

  startStop.textContent = "Play";
  document.getElementById("playSong").textContent = "Play Song";
}

function loadSongPattern(patternName) {
  currentPattern = patternName;

  sequencer.setPattern(patterns[currentPattern]);
  patternLength.value = patterns[currentPattern].length;

  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pattern === currentPattern);
  });

  renderGrid();
  highlightCurrentSongItem();
}

function goToNextSongPattern() {
  if (!songPlaying) return;

  songPatternIndex++;

  if (songPatternIndex >= songOrder.length) {
    songPatternIndex = 0;
  }

  loadSongPattern(songOrder[songPatternIndex]);
}

function highlightCurrentSongItem() {
  document.querySelectorAll(".song-item").forEach((item, index) => {
    item.classList.toggle(
      "playing-song-item",
      songPlaying && index === songPatternIndex
    );
  });
}


// =======================
// SAVE / LOAD PROJECT
// =======================
document.getElementById("exportProject").addEventListener("click", async () => {
  const zip = new JSZip();
  
  const project = getProjectData();
  zip.file("project.json", JSON.stringify(project, null, 2));
  
  const samplesFolder = zip.folder("samples");
  let sampleCount = 0;
  
  for (const [track, sample] of customSamples.entries()) {
    const wavBlob = await audioBufferToWavBlob(sample.buffer);
    samplesFolder.file(`${track}.wav`, wavBlob);
    sampleCount++;
  }
  
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "drum-project.zip";
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importProject").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.name.endsWith('.zip')) {
    try {
      const zip = await JSZip.loadAsync(file);
      
      // Load JSON
      const jsonFile = zip.file("project.json");
      const projectData = JSON.parse(await jsonFile.async("string"));
      
      // Load samples from samples folder
      const samplesFolder = zip.folder("samples");
      if (samplesFolder) {
        for (const track of ['kick', 'snare', 'hihat', 'tom']) {
          const sampleFile = samplesFolder.file(`${track}.wav`);
          if (sampleFile) {
            const arrayBuffer = await sampleFile.async("arraybuffer");
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            await loadCustomSampleFromBuffer(track, audioBuffer, `${track}.wav`);
          }
        }
      }
      
      loadProjectData(projectData);
    } catch (error) {
      console.error(error);
    }
  } else {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const project = JSON.parse(reader.result);
        loadProjectData(project);
      } catch (error) {
        console.error(error);
      }
    };
    reader.readAsText(file);
  }
  
  event.target.value = "";
});

function getProjectData() {
  const updatedPatterns = structuredClone(patterns);
  updatedPatterns[currentPattern] = sequencer.getPattern();

  return {
    bpm: sequencer.bpm,
    swing: sequencer.swing,
    currentPattern,
    patterns: updatedPatterns,
    songOrder: structuredClone(songOrder),
    effects: structuredClone(effects),
    sampleSettings: structuredClone(sampleSettings)
  };
}

function loadProjectData(project) {
  patterns = project.patterns || patterns;
  songOrder = project.songOrder || [];
  currentPattern = project.currentPattern || "A";

  effects.delay = project.effects?.delay ?? 0;
  effects.reverb = project.effects?.reverb ?? 0;
  effects.distortion = project.effects?.distortion ?? 0;
  effects.compressor = project.effects?.compressor ?? -24;
  effects.eqLow = project.effects?.eqLow ?? 0;
  effects.eqMid = project.effects?.eqMid ?? 0;
  effects.eqHigh = project.effects?.eqHigh ?? 0;

  sequencer.bpm = project.bpm || 100;
  sequencer.swing = project.swing || 0;

  bpmSlider.value = sequencer.bpm;
  bpmValue.textContent = sequencer.bpm;

  swingSlider.value = sequencer.swing;
  swingValue.textContent = `${sequencer.swing}%`;

  sequencer.setPattern(patterns[currentPattern]);
  patternLength.value = patterns[currentPattern].length;

  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pattern === currentPattern);
  });

  if (project.sampleSettings) {
    Object.assign(sampleSettings, project.sampleSettings);
  }

  updateEffectsUI();
  updateAudioEffects();
  renderGrid();
  renderSongOrder();
  updateSampleList();
  autosave();
}

function updateEffectsUI() {
  Object.keys(effects).forEach(id => {
    const input = document.getElementById(id);

    if (input) {
      input.value = effects[id];
    }
  });
}

async function audioBufferToWavBlob(buffer) {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const channelData = [];
  
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }
  
  const wavBytes = wavBytesFromAudioBuffer(channelData, length, sampleRate, numberOfChannels);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

function wavBytesFromAudioBuffer(channelData, length, sampleRate, numChannels) {
  const bufferLength = 44 + (length * numChannels * 2);
  const view = new DataView(new ArrayBuffer(bufferLength));
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return view.buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function loadCustomSampleFromBuffer(track, audioBuffer, fileName) {
  let processedBuffer = audioBuffer;
  if (sampleSettings[track].reverse) {
    processedBuffer = reverseBuffer(audioBuffer);
  }
  
  customSamples.set(track, {
    buffer: processedBuffer,
    fileName: fileName,
    settings: { ...sampleSettings[track] }
  });
  
  buffers[track] = processedBuffer;
  updateSampleList();
}

// =======================
// RESET PROJECT
// =======================

function resetProject() {
  sequencer.stop();
  stopAllSounds();

  patterns = {
  A: {
    length: 8,
    kick: [1, 1, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [0, 1, 1, 1, 0, 1, 1, 1],
    tom: [0, 0, 0, 1, 0, 1, 1, 1]
  },
  B:{
    length: 8,
    kick: [1, 1, 0, 1, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 1],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1],
    tom: [0, 0, 0, 0, 0, 0, 0, 0]
  },
  C: {
    length: 8,
    kick: [1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 1],
    hihat: [0, 1, 0, 1, 0, 1, 0, 1],
    tom: [0, 1, 0, 0, 0, 0, 0, 1]
  },
  D: {
    length: 8,
    kick: [1, 0, 0, 0, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [0, 1, 0, 1, 0, 1, 0, 1],
    tom: [0, 0, 0, 1, 0, 0, 0, 0]
  }
};

  currentPattern = "A";
  copiedPattern = null;
  songOrder = [];
  songPlaying = false;
  songPatternIndex = 0;

  sequencer.bpm = 100;
  sequencer.swing = 0;

  effects.delay = 0;
  effects.compressor = -24;
  effects.eqLow = 0;
  effects.eqMid = 0;
  effects.eqHigh = 0;

  sequencer.setPattern(patterns[currentPattern]);

  bpmSlider.value = 100;
  bpmValue.textContent = "100";

  swingSlider.value = 0;
  swingValue.textContent = "0%";

  patternLength.value = 8;

  startStop.textContent = "Play";
  document.getElementById("playSong").textContent = "Play Song";

  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pattern === "A");
  });

  ['kick', 'snare', 'hihat', 'tom'].forEach(track => {
    resetTrackToDefault(track);
  });

  updateEffectsUI();
  updateAudioEffects();
  renderGrid();
  renderSongOrder();

  localStorage.removeItem("drumProject");
  autosave();
}


// =======================
// AUTOSAVE AND EFFECT LISTENERS
// =======================

function autosave() {
  localStorage.setItem("drumProject", JSON.stringify(getProjectData()));
  autosaveStatus.textContent = "Autosaved";
}

["delay", "reverb", "distortion", "compressor", "eqLow", "eqMid", "eqHigh"].forEach(id => {
  document.getElementById(id).addEventListener("input", event => {
    effects[id] = Number(event.target.value);

    updateAudioEffects();

    autosave();
  });
});

const savedProject = localStorage.getItem("drumProject");


// =======================
// CUSTOM SAMPLE LOADER FUNCTIONS
// =======================

let currentEditTrack = 'kick';

function reverseBuffer(buffer) {
  const reversedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      reversedData[i] = channelData[channelData.length - 1 - i];
    }
  }
  return reversedBuffer;
}

async function loadCustomSample(track, file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    let processedBuffer = audioBuffer;
    if (sampleSettings[track].reverse) {
      processedBuffer = reverseBuffer(audioBuffer);
    }
    
    customSamples.set(track, {
      buffer: processedBuffer,
      fileName: file.name,
      settings: { ...sampleSettings[track] }
    });
    
    buffers[track] = processedBuffer;
    updateSampleList();

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}


function updateSampleList() {
  if (!sampleList) return;
  
  sampleList.innerHTML = '';
  const trackNames = ['kick', 'snare', 'hihat', 'tom'];
  
  trackNames.forEach(track => {
    const customSample = customSamples.get(track);
    const settings = sampleSettings[track];
    
    const item = document.createElement('div');
    item.className = 'sample-item';
    item.onclick = () => {
      document.querySelectorAll('.sample-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentEditTrack = track;
      loadSampleToEditor(track);
      sampleEditor.style.display = 'block';
    };
    
    item.innerHTML = `
      <div class="sample-name">${track.toUpperCase()}</div>
      <div class="sample-file">${customSample ? customSample.fileName : 'Default sample'}</div>
      <div class="sample-stats">Vol: ${settings.volume}% | Pitch: ${settings.pitch}x${settings.reverse ? ' | 🔁 Reversed' : ''}</div>
    `;
    
    sampleList.appendChild(item);
  });
}

function loadSampleToEditor(track) {
  const settings = sampleSettings[track];
  editSampleSelect.value = track;
  sampleVolume.value = settings.volume;
  volumeValue.textContent = settings.volume;
  samplePitch.value = settings.pitch;
  pitchValue.textContent = settings.pitch.toFixed(2);
  sampleReverse.checked = settings.reverse;
  currentEditTrack = track;
}

function resetTrackToDefault(track) {
  sampleSettings[track] = { volume: 100, pitch: 1, reverse: false };
  customSamples.delete(track);

  loadAudio(track, `./sounds/${track}.wav`);
  updateSampleList();
  
  if (currentEditTrack === track) {
    loadSampleToEditor(track);
  }
}

function testPlayCurrentSample() {
  playSound(currentEditTrack, 0);
}

function playPreview() {
  const tempSettings = {
    volume: parseInt(sampleVolume.value),
    pitch: parseFloat(samplePitch.value),
    reverse: sampleReverse.checked
  };
  
  const buffer = buffers[currentEditTrack];
  if (!buffer) {
    return;
  }
  
  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  
  source.playbackRate.value = tempSettings.pitch;
  gainNode.gain.value = tempSettings.volume / 100;
  
  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(masterGain);
  
  activeSources.push(source);
  
  source.onended = () => {
    const index = activeSources.indexOf(source);
    if (index !== -1) {
      activeSources.splice(index, 1);
    }
  };
  
  source.start(0);
  triggerMeter(currentEditTrack);
}

function autoAssignSample(file) {
  const fileName = file.name.toLowerCase();
  
  if (fileName.includes('kick') || fileName.includes('bass')) {
    return 'kick';
  }
  if (fileName.includes('snare') || fileName.includes('clap')) {
    return 'snare';
  }
  if (fileName.includes('hihat') || fileName.includes('cymbal')) {
    return 'hihat';
  }
  if (fileName.includes('tom') || fileName.includes('tomtom')) {
    return 'tom';
  }
  return null; 
}

if (dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    let autoAssigned = false;
    
    for (const file of files) {
      const autoTrack = autoAssignSample(file);
      if (autoTrack) {
        await loadCustomSample(autoTrack, file);
        autoAssigned = true;
      }
    }
    
    for (const file of files) {
      const autoTrack = autoAssignSample(file);
      if (!autoTrack) {
        const track = prompt(`Could not auto-assign "${file.name}". Assign to which track?\n(kick, snare, hihat, tom)`, 'kick');
        if (track && ['kick', 'snare', 'hihat', 'tom'].includes(track.toLowerCase())) {
          await loadCustomSample(track.toLowerCase(), file);
        }
      }
    }
  });
  
  dropZone.addEventListener('click', () => {
    sampleUpload.click();
  });
  
  if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sampleUpload.click();
    });
  }
  
  if (sampleUpload) {
    sampleUpload.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      let autoAssigned = false;
      
      for (const file of files) {
        const autoTrack = autoAssignSample(file);
        if (autoTrack) {
          await loadCustomSample(autoTrack, file);
          autoAssigned = true;
        }
      }
      
      for (const file of files) {
        const autoTrack = autoAssignSample(file);
        if (!autoTrack) {
          const track = prompt(`Could not auto-assign "${file.name}". Assign to which track?\n(kick, snare, hihat, tom)`, 'kick');
          if (track && ['kick', 'snare', 'hihat', 'tom'].includes(track.toLowerCase())) {
            await loadCustomSample(track.toLowerCase(), file);
          }
        }
      } 
      sampleUpload.value = '';
    });
  }
}

if (saveSampleSettings) {
  saveSampleSettings.addEventListener('click', async () => {
    const newSettings = {
      volume: parseInt(sampleVolume.value),
      pitch: parseFloat(samplePitch.value),
      reverse: sampleReverse.checked
    };
    
    sampleSettings[currentEditTrack] = newSettings;
    
    const customSample = customSamples.get(currentEditTrack);
    if (customSample) {
      customSample.settings = newSettings;
      let processedBuffer = customSample.buffer;
      if (newSettings.reverse) {
        processedBuffer = reverseBuffer(customSample.buffer);
      }
      buffers[currentEditTrack] = processedBuffer;
    }
    
    updateSampleList();
  });
}

if (resetSample) {
  resetSample.addEventListener('click', () => {
    resetTrackToDefault(currentEditTrack);
  });
}

if (editSampleSelect) {
  editSampleSelect.addEventListener('change', (e) => {
    currentEditTrack = e.target.value;
    loadSampleToEditor(currentEditTrack);
  });
}

if (sampleVolume) {
  sampleVolume.addEventListener('input', () => {
    volumeValue.textContent = sampleVolume.value;
    playPreview();
  });
}

if (samplePitch) {
  samplePitch.addEventListener('input', () => {
    pitchValue.textContent = parseFloat(samplePitch.value).toFixed(2);
    playPreview();
  });
}

if (sampleReverse) {
  sampleReverse.addEventListener('change', () => {
    playPreview();
  });
}


// =======================
// Initialization
// =======================
renderGrid();
renderSongOrder();
updateEffectsUI();
updateAudioEffects();
updateSampleList();