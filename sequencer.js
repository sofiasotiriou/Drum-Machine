export class Sequencer {
  constructor(audioContext, playSound, onStepChange = null) {
    this.audioContext = audioContext;
    this.playSound = playSound;
    this.onStepChange = onStepChange;

    this.stepsPerBeat = 8;

    this.snare = [0, 0, 0, 0, 1, 0, 0, 0];
    this.hihat = [0, 1, 1, 1, 0, 1, 1, 1];
    this.kick = [1, 1, 0, 0, 0, 0, 0, 0];
    this.tom = [0, 0, 0, 1, 0, 1, 1, 1];

    this.playing = false;
    this.bpm = 100;
    this.swing = 0;

    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timeoutId = null;
  }

  setPattern(pattern) {
    this.kick = [...pattern.kick];
    this.snare = [...pattern.snare];
    this.hihat = [...pattern.hihat];
    this.tom = [...pattern.tom];
    this.stepsPerBeat = pattern.length;
  }

  getPattern() {
    return {
      length: this.stepsPerBeat,
      kick: [...this.kick],
      snare: [...this.snare],
      hihat: [...this.hihat],
      tom: [...this.tom]
    };
  }

  scheduleStep() {
    if (!this.playing) return;

    this.playStep(this.currentStep);

    if (this.onStepChange) {
      this.onStepChange(this.currentStep);
    }

    const secondsPerBeat = 60 / this.bpm;
    let secondsPerStep = secondsPerBeat / 2;

    if (this.currentStep % 2 === 1) {
      secondsPerStep += secondsPerStep * (this.swing / 100) * 0.5;
    }

    this.currentStep = (this.currentStep + 1) % this.stepsPerBeat;
    this.nextStepTime += secondsPerStep;

    const delay = (this.nextStepTime - this.audioContext.currentTime) * 1000;

    this.timeoutId = setTimeout(
      () => this.scheduleStep(),
      Math.max(0, delay)
    );
  }

  playStep(step) {
    if (this.kick[step] === 1) {
      this.playSound("kick", this.audioContext.currentTime);
    }

    if (this.snare[step] === 1) {
      this.playSound("snare", this.audioContext.currentTime);
    }

    if (this.hihat[step] === 1) {
      this.playSound("hihat", this.audioContext.currentTime);
    }

    if (this.tom[step] === 1) {
      this.playSound("tom", this.audioContext.currentTime);
    }
  }

  start() {
    if (this.playing) return;

    this.playing = true;
    this.currentStep = 0;
    this.nextStepTime = this.audioContext.currentTime + 0.05;
    this.scheduleStep();
  }

  stop() {
    this.playing = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.onStepChange) {
      this.onStepChange(-1);
    }
  }
}