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
  B: defaultPattern(8),
  C: defaultPattern(8),
  D: defaultPattern(8)
};

let currentPattern = "A";
let copiedPattern = null;
let songOrder = [];
let songPlaying = false;
let songPatternIndex = 0;

const effects = {
  delay: 0,
  compressor: -24,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0
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


// =======================
// AUDIO ROUTING
// =======================

masterGain.connect(lowEQ);
lowEQ.connect(midEQ);
midEQ.connect(highEQ);
highEQ.connect(compressor);
compressor.connect(audioContext.destination);

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

  const source = audioContext.createBufferSource();

  source.buffer = buffer;
  source.connect(masterGain);

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

  tracks.forEach(track => {
    for (let i = 0; i < Math.min(oldPattern.length, newLength); i++) {
      newPattern[track][i] = oldPattern[track][i];
    }
  });

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

document.getElementById("exportProject").addEventListener("click", () => {
  const project = getProjectData();

  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "drum-project.json";
  link.click();

  URL.revokeObjectURL(url);
});

document.getElementById("importProject").addEventListener("change", event => {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const project = JSON.parse(reader.result);
      loadProjectData(project);
      alert("Project loaded successfully!");
    } catch (error) {
      console.error("Invalid JSON file:", error);
      alert("Invalid JSON file.");
    }
  };

  reader.readAsText(file);

  event.target.value = "";
});

function getProjectData() {
  patterns[currentPattern] = sequencer.getPattern();

  return {
    bpm: sequencer.bpm,
    swing: sequencer.swing,
    currentPattern,
    patterns,
    songOrder,
    effects
  };
}

function loadProjectData(project) {
  patterns = project.patterns || patterns;
  songOrder = project.songOrder || [];
  currentPattern = project.currentPattern || "A";

  effects.delay = project.effects?.delay ?? 0;
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

  updateEffectsUI();
  updateAudioEffects();
  renderGrid();
  renderSongOrder();
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
    B: defaultPattern(8),
    C: defaultPattern(8),
    D: defaultPattern(8)
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

["delay", "compressor", "eqLow", "eqMid", "eqHigh"].forEach(id => {
  document.getElementById(id).addEventListener("input", event => {
    effects[id] = Number(event.target.value);

    updateAudioEffects();

    autosave();
  });
});

const savedProject = localStorage.getItem("drumProject");

if (savedProject) {
  loadProjectData(JSON.parse(savedProject));
}

renderGrid();
renderSongOrder();
updateEffectsUI();
updateAudioEffects();