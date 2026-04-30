export class Sequencer {

    constructor(audioContext, playSound) {
        this.audioContext = audioContext;
        this.playSound = playSound;

        //default grid based on the shiny drum machine example. Maybe somehow highlight them? 
        this.snare = [0,0,0,0,1,0,0,0];
        this.hihat = [0,1,1,1,0,1,1,1];
        this.kick = [1,1,0,0,0,0,0,0,0];
        this.tom = [0,0,0,1,0,1,1,1];
        this.playing = false;
        this.bpm = 100;

        this.currentStep = 0;
        this.nextStepTime = 0;
        this.timeoutId = null;
        this.stepsPerBeat = 8;  // Number of steps in sequencer
    }

    setSnare(step) {
        if (this.snare[step] == 0) {
            this.snare[step] = 1;
        } else {
            this.snare[step] = 0;
        }
    }

    setHihat(step) {
        if (this.hihat[step] == 0) {
            this.hihat[step] = 1;
        } else {
            this.hihat[step] = 0;
        }
    }

    setKick(step) {
        if (this.kick[step] == 0) {
            this.kick[step] = 1;
        } else {
            this.kick[step] = 0;
        }
    }

    setTom(step) {
        if (this.tom[step] == 0) {
            this.tom[step] = 1;
        } else {
            this.tom[step] = 0;
        }
    }

    
    scheduleStep() {
        if (!this.playing) return;
        this.playStep(this.currentStep);
        
        const secondsPerBeat = 60.0 / this.bpm;
        const secondsPerStep = secondsPerBeat / (this.stepsPerBeat / 4);
        
        this.currentStep = (this.currentStep + 1) % this.stepsPerBeat;
        this.nextStepTime += secondsPerStep;

        const delay = (this.nextStepTime - this.audioContext.currentTime) * 1000;
        if (delay > 0) {
            this.timeoutId = setTimeout(() => this.scheduleStep(), delay);
        } else {
            // Behind schedule
            this.scheduleStep();
        }
    }
    
    playStep(step) {
        if (this.kick[step] === 1) {
            this.playSound('kick', this.audioContext.currentTime);
        }
        if (this.snare[step] === 1) {
            this.playSound('snare', this.audioContext.currentTime);
        }
        if (this.hihat[step] === 1) {
            this.playSound('hihat', this.audioContext.currentTime);
        }
        if (this.tom[step] === 1) {
            this.playSound('tom', this.audioContext.currentTime);
        }
    }


    start() {
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
    }    

    upBPM() {
        if (this.bpm + 4 <= 180) {      //maximum bpm
            this.bpm = this.bpm + 4;
        }
        console.log(this.bpm)
    }

    downBPM() {
        if (this.bpm - 4 >= 50) {        //minimum bpm
            this.bpm = this.bpm - 4;
        }
        console.log(this.bpm)

    }


}