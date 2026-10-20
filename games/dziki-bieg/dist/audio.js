import {HoofCadence} from './gait.js';
/* Original fallback synth: “Chrome Daydream”, a looping instrumental written for this game. */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 124;
const STEP = 60 / BPM / 4;
const CHORDS = [
  [50, 57, 61, 64, 69], [50, 57, 61, 64, 69],
  [45, 52, 57, 59, 64], [45, 52, 57, 59, 64],
  [47, 54, 57, 62, 66], [47, 54, 57, 62, 66],
  [43, 50, 57, 59, 62], [43, 50, 57, 59, 62],
  [50, 57, 61, 64, 69], [50, 57, 61, 64, 69],
  [45, 52, 57, 59, 64], [45, 52, 57, 59, 64],
  [43, 50, 57, 59, 62], [43, 50, 57, 59, 62],
  [45, 52, 57, 59, 64], [45, 52, 57, 59, 64],
];
// Sparse, deliberately original lead phrases, one note per eighth note.
const LEAD = [
  [78, 0, 81, 78, 76, 0, 73, 76], [0, 74, 78, 81, 0, 83, 81, 0],
  [76, 0, 73, 71, 69, 0, 73, 76], [0, 78, 76, 73, 0, 71, 69, 0],
  [74, 0, 78, 81, 83, 0, 81, 78], [0, 76, 74, 78, 0, 81, 78, 0],
  [74, 0, 71, 69, 67, 0, 69, 71], [0, 74, 78, 76, 0, 73, 71, 0],
];

export class AudioSystem {
  constructor(defaultTrack = null) {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.synthBus = null;
    this.effectsBus = null;
    this.musicVolume = 1;
    this.effectsVolume = 1;
    this.muted = false;
    this.playing = false;
    this.timer = null;
    this.sources = new Set();
    this.trackBuffer = null;
    this.trackName = null;
    this.trackOffset = 0;
    this.trackSource = null;
    this.trackStarted = 0;
    this.transportStep = 0;
    this.transportStarted = 0;
    this.transportStartStep = 0;
    this.nextStep = 0;
    this.nextTime = 0;
    this.noiseBuffer = null;
    this.woodCrackBuffer = null;
    this.hoofCadence = new HoofCadence();
    this.hoofSources = new Set();
    this.hoofBuffers = null;
    this.hoofSerial = 0;
    this.recordingBuffers = new Map();
    this.recordingData = this.loadRecordings();
    this.recordingReady = null;
    this.loadVersion = 0;
    this.defaultTrack = defaultTrack;
    this.defaultSource = null;
    this.defaultGain = null;
    this.defaultPrimed = false;
    this.defaultPriming = null;
    this.defaultFailed = false;
    this.defaultResetPending = false;
    this.musicMode = null;
    this.musicStartToken = 0;
    if (defaultTrack) {
      defaultTrack.loop = true;
      defaultTrack.addEventListener('error', () => this.failDefaultTrack());
      defaultTrack.addEventListener('loadedmetadata', () => {
        if (this.defaultResetPending) {
          defaultTrack.currentTime = 0;
          this.defaultResetPending = false;
        }
      });
    }
  }

  async unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.58;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 18;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.16;
      this.master.connect(limiter).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.7 * this.musicVolume;
      this.musicBus.connect(this.master);
      this.synthBus = ctx.createGain();
      this.synthBus.connect(this.musicBus);
      this.effectsBus = ctx.createGain();
      this.effectsBus.gain.value = 0.75 * this.effectsVolume;
      this.effectsBus.connect(this.master);
      this.prepareHooves();

      // A short stereo echo gives the synths space without a large impulse file.
      const echo = ctx.createDelay(1);
      echo.delayTime.value = 60 / BPM * 0.75;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.23;
      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = 2300;
      const wet = ctx.createGain();
      wet.gain.value = 0.14;
      this.synthBus.connect(echo);
      echo.connect(echoFilter).connect(feedback).connect(echo);
      echoFilter.connect(wet).connect(this.musicBus);

      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.makeWoodCrack();
      if (this.defaultTrack && !this.defaultFailed) {
        try {
          this.defaultSource = ctx.createMediaElementSource(this.defaultTrack);
          this.defaultGain = ctx.createGain();
          this.defaultGain.gain.value = 0;
          this.defaultSource.connect(this.defaultGain).connect(this.musicBus);
        } catch (_) {
          this.defaultFailed = true;
        }
      }
    }
    // Prime the media element inside the title/button gesture. The silent gain
    // prevents a preview during instructions and unlocks delayed play on mobile.
    if (this.defaultTrack && !this.defaultFailed && !this.defaultPrimed && !this.defaultPriming && !this.playing && !this.trackBuffer && (!navigator.userActivation || navigator.userActivation.isActive)) {
      try {
        this.defaultPriming = Promise.resolve(this.defaultTrack.play()).then(() => {
          this.defaultPrimed = true;
          if (!this.playing || this.musicMode !== 'default') {
            this.defaultTrack.pause();
            this.defaultTrack.currentTime = 0;
          }
        }).catch(error => {
          if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') this.failDefaultTrack();
        }).finally(() => { this.defaultPriming = null; });
      } catch (_) { this.failDefaultTrack(); }
    }
    if (this.context.state === 'suspended') await this.context.resume();
    await this.prepareRecordings();
    return this.context.state === 'running';
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.58, now, 0.025);
    }
  }

  setMusicVolume(value) {
    this.musicVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    this.setBusVolume(this.musicBus, 0.7 * this.musicVolume);
  }

  setEffectsVolume(value) {
    this.effectsVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    this.setBusVolume(this.effectsBus, 0.75 * this.effectsVolume);
  }

  setBusVolume(bus, volume) {
    if (!bus) return;
    const now = this.context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(volume, now, 0.025);
  }

  startMusic() {
    if (!this.context || this.context.state !== 'running' || this.playing) return;
    this.playing = true;
    const token = ++this.musicStartToken;
    const now = this.context.currentTime;
    if (this.trackBuffer) {
      this.musicMode = 'upload';
      const source = this.context.createBufferSource();
      source.buffer = this.trackBuffer;
      source.loop = true;
      source.connect(this.musicBus);
      source.start(now, this.trackOffset % this.trackBuffer.duration);
      this.trackSource = source;
      this.trackStarted = now;
      return;
    }
    if (this.defaultTrack && !this.defaultFailed) {
      this.musicMode = 'default';
      this.defaultGain.gain.setValueAtTime(1, now);
      const failed = error => {
        if (token !== this.musicStartToken || !this.playing || this.musicMode !== 'default') return;
        if (error.name === 'NotAllowedError') {
          this.defaultTrack.pause();
          this.defaultGain.gain.setValueAtTime(0, this.context.currentTime);
          this.musicMode = 'synth';
          this.startSynthMusic();
        } else this.failDefaultTrack();
      };
      try {
        const play = this.defaultTrack.play();
        if (play && typeof play.catch === 'function') play.catch(failed);
      } catch (error) { failed(error); }
      return;
    }
    this.musicMode = 'synth';
    this.startSynthMusic();
  }

  startSynthMusic() {
    const now = this.context.currentTime;
    this.transportStartStep = this.transportStep;
    this.transportStarted = now + 0.035;
    this.nextStep = this.transportStep;
    this.nextTime = this.transportStarted;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stopMusic() {
    ++this.musicStartToken;
    if (this.defaultTrack) this.defaultTrack.pause();
    if (!this.context) { this.playing = false; this.musicMode = null; return; }
    if (this.defaultGain) this.defaultGain.gain.setValueAtTime(0, this.context.currentTime);
    if (this.playing) {
      if (this.trackSource) {
        this.trackOffset = (this.trackOffset + this.context.currentTime - this.trackStarted) % this.trackBuffer.duration;
      } else if (this.musicMode === 'synth') {
        this.transportStep = (this.transportStartStep + Math.max(0, Math.floor((this.context.currentTime - this.transportStarted) / STEP))) % 256;
      }
    }
    this.playing = false;
    this.musicMode = null;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.trackSource) {
      try { this.trackSource.stop(); } catch (_) { /* already stopped */ }
      this.trackSource.disconnect();
      this.trackSource = null;
    }
    for (const source of this.sources) {
      try { source.stop(); } catch (_) { /* already stopped */ }
    }
    this.sources.clear();
  }

  resetMusic() {
    this.stopMusic();
    this.transportStep = 0;
    this.trackOffset = 0;
    if (this.defaultTrack) {
      try { this.defaultTrack.currentTime = 0; this.defaultResetPending = false; }
      catch (_) { this.defaultResetPending = true; }
    }
  }

  failDefaultTrack() {
    this.defaultFailed = true;
    if (this.defaultTrack) this.defaultTrack.pause();
    if (this.playing && this.musicMode === 'default') {
      this.stopMusic();
      this.startMusic();
    }
  }

  async loadTrack(file) {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose an audio file.');
    const version = ++this.loadVersion;
    if (!(await this.unlock())) throw new Error('Audio is unavailable in this browser.');
    const buffer = await this.context.decodeAudioData(await file.arrayBuffer());
    if (version !== this.loadVersion) return this.trackName;
    if (!buffer.duration) throw new Error('This audio file is empty.');
    const wasPlaying = this.playing;
    this.stopMusic();
    this.trackBuffer = buffer;
    this.trackName = file.name || 'Your soundtrack';
    this.trackOffset = 0;
    if (wasPlaying) this.startMusic();
    return this.trackName;
  }

  schedule() {
    if (!this.playing || !this.context) return;
    const now = this.context.currentTime;
    // Hidden or throttled tabs never accumulate a burst of old notes.
    if (this.nextTime < now - STEP) {
      const skipped = Math.ceil((now - this.nextTime) / STEP);
      this.nextStep += skipped;
      this.nextTime += skipped * STEP;
    }
    while (this.nextTime < now + 0.3) {
      this.sequence(this.nextStep % 256, this.nextTime);
      this.nextStep++;
      this.nextTime += STEP;
    }
  }

  sequence(step, time) {
    const bar = Math.floor(step / 16);
    const beat = step % 16;
    const chord = CHORDS[bar];
    if (beat === 0) {
      for (let i = 1; i < chord.length; i++) this.tone(chord[i], time, STEP * 17, 0.022, 'triangle', 'music', 0.28, 1500, i % 2 ? -0.45 : 0.45);
    }
    if (beat % 4 === 0) {
      this.kick(time);
      this.tone(chord[0] - 12, time, STEP * 2.5, 0.15, 'triangle', 'music', 0.009, 600, 0);
    } else if (beat === 6 || beat === 14) {
      this.tone(chord[0], time, STEP * 1.3, 0.065, 'triangle', 'music', 0.009, 700, 0);
    }
    if (beat === 4 || beat === 12) this.noise(time, 0.16, 0.07, 1300, 'highpass', 'music');
    if (beat % 2 === 0) this.noise(time, beat === 14 ? 0.095 : 0.045, 0.025, 6500, 'highpass', 'music');

    // Wide ascending arpeggios, with an occasional syncopated upper octave.
    const arp = [1, 3, 2, 4, 1, 2, 3, 4][Math.floor(beat / 2)];
    if (beat % 2 === 1) this.tone(chord[arp] + 12, time, STEP * 1.6, 0.028, 'sine', 'music', 0.005, 5000, beat % 4 === 1 ? -0.3 : 0.3);
    if (bar >= 4 && beat % 2 === 0) {
      const note = LEAD[bar % 8][beat / 2];
      if (note) {
        this.tone(note, time, STEP * 2.8, 0.043, 'triangle', 'music', 0.025, 3100, -0.1);
        this.tone(note, time, STEP * 2.8, 0.018, 'sine', 'music', 0.025, 5000, 0.15, 5);
      }
    }
  }

  register(source, route) {
    if (route === 'music') this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      try { source.disconnect(); } catch (_) { /* no remaining connections */ }
    };
  }

  tone(note, time, duration, volume, type = 'sine', route = 'effects', attack = 0.006, cutoff = 5000, pan = 0, detune = 0, endNote = null) {
    const ctx = this.context;
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(NOTE(note), time);
    if (endNote !== null) oscillator.frequency.exponentialRampToValueAtTime(NOTE(endNote), time + duration);
    oscillator.detune.value = detune;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + Math.min(attack, duration * 0.4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter).connect(envelope);
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner).connect(route === 'music' ? this.synthBus || this.musicBus : this.effectsBus);
    } else envelope.connect(route === 'music' ? this.synthBus || this.musicBus : this.effectsBus);
    this.register(oscillator, route);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  noise(time, duration, volume, cutoff, type = 'highpass', route = 'effects') {
    const ctx = this.context;
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(volume, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(envelope).connect(route === 'music' ? this.synthBus || this.musicBus : this.effectsBus);
    this.register(source, route);
    source.start(time, Math.random() * 0.5);
    source.stop(time + duration);
  }

  kick(time) {
    this.tone(48, time, 0.18, 0.24, 'sine', 'music', 0.003, 600, 0, 0, 25);
  }

  makeWoodCrack() {
    if (this.woodCrackBuffer) return this.woodCrackBuffer;
    const ctx = this.context, rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.ceil(rate * 0.27), rate);
    const data = buffer.getChannelData(0);
    // Local deterministic excitation keeps cosmetic sound out of game RNG.
    let seed = 0x6b8b4567, smooth = 0, grain = 0, peak = 0;
    const modes = [[197,.032,.24],[347,.026,.19],[619,.020,.15],
      [1063,.014,.10],[1739,.010,.07],[2761,.007,.035]];
    const splinters = [[.047,.23],[.073,.16],[.111,.11],[.157,.075],[.209,.045]];
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = (seed >>> 0) / 2147483648 - 1;
      smooth += .075 * (white - smooth);
      grain += .26 * (white - grain);
      const crisp = white - smooth;
      // Several very close fractures make one heavy, dry snap, not a chime.
      let envelope = Math.exp(-t / .0038);
      if (t >= .0065) envelope += .65 * Math.exp(-(t - .0065) / .005);
      if (t >= .015) envelope += .32 * Math.exp(-(t - .015) / .009);
      let value = crisp * envelope * .65;
      const attack = 1 - Math.exp(-t / .00045);
      for (const [frequency, decay, gain] of modes) {
        value += Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / decay) * gain * attack;
      }
      const crunch = Math.exp(-t / .056) * (1 - Math.exp(-t / .003));
      value += (grain - smooth) * crunch * (.65 + .35 * Math.abs(Math.sin(t * 419) * Math.sin(t * 733)));
      for (const [offset, gain] of splinters) {
        const age = t - offset;
        if (age >= 0 && age < .025) value += crisp * gain * Math.exp(-age / .0028) * (1 - Math.exp(-age / .00013));
      }
      value *= Math.min(1, t / .0002) * Math.min(1, (buffer.duration - t) / .006);
      data[i] = value; peak = Math.max(peak, Math.abs(value));
    }
    const scale = .9 / Math.max(peak, .001);
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    this.woodCrackBuffer = buffer;
    return buffer;
  }

  prepareHooves() {
    if(this.hoofBuffers||!this.context)return;
    const rate=this.context.sampleRate;
    this.hoofBuffers=[0,1,2].map(variant=>{
      const buffer=this.context.createBuffer(1,Math.ceil(rate*.085),rate),data=buffer.getChannelData(0);
      let seed=0x15e74a+variant*103,low=0;
      for(let i=0;i<data.length;i++){
        const t=i/rate;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
        const noise=(seed>>>0)/2147483648-1;low+=(noise-low)*.12;
        const attack=Math.min(1,t/.0015),tail=Math.min(1,(buffer.duration-t)/.006);
        const knock=Math.sin(t*Math.PI*2*(116+variant*9))*Math.exp(-t/.012)*.17;
        const earth=(low*.8+noise*.11)*Math.exp(-t/.019)*.6;
        const leaf=t>.012?(noise-low)*Math.exp(-(t-.012)/.015)*.035:0;
        data[i]=(knock+earth+leaf)*attack*tail;
      }
      return buffer;
    });
  }

  stopHooves() {
    for(const source of this.hoofSources){try{source.stop();}catch{}}
    this.hoofSources.clear();
  }

  updateRunning(player,playing) {
    const contact=this.hoofCadence.contact(player,playing);
    if(!playing||!player?.grounded||player.animState!=='run'){this.stopHooves();return;}
    if(contact&&this.context?.state==='running'&&!this.muted&&this.effectsVolume>0)this.hoofStep();
  }

  hoofStep() {
    this.prepareHooves();
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=this.hoofBuffers[this.hoofSerial++%3];
    source.playbackRate.value=1+(this.hoofSerial%3-1)*.035;
    gain.gain.value=.7;source.connect(gain).connect(this.effectsBus);this.hoofSources.add(source);
    source.onended=()=>{this.hoofSources.delete(source);source.disconnect();gain.disconnect();};
    source.start(this.context.currentTime);
  }

  woodCrack(time) {
    const source = this.context.createBufferSource();
    source.buffer = this.makeWoodCrack();
    // All fracture layers share one cached voice and the event's exact time.
    source.connect(this.effectsBus);
    this.register(source, 'effects');
    source.start(time);
  }

  async loadRecordings() {
    try {
      return await Promise.all([['boar', 'boar-start.mp3'], ['death', 'boar-hit.mp3']].map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not load boar recording');
        return [name, await response.arrayBuffer()];
      }));
    } catch (error) { this.recordingLoadError = error; return []; }
  }

  prepareRecordings() {
    if (!this.recordingReady) this.recordingReady = this.recordingData.then(data => Promise.all(data.map(async ([name, bytes]) => {
      this.recordingBuffers.set(name, await this.context.decodeAudioData(bytes));
    }))).catch(error => { this.recordingLoadError = error; });
    return this.recordingReady;
  }

  playRecording(name, time) {
    const buffer = this.recordingBuffers.get(name);
    if (!buffer) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = name === 'death' ? .95 : 1.1;
    source.connect(gain).connect(this.effectsBus);
    this.register(source, 'effects');
    source.start(time);
  }

  effect(name) {
    if (!this.context || this.context.state !== 'running') return;
    const time = this.context.currentTime;
    switch (name) {
      case 'boar':
        this.playRecording('boar', time);
        break;
      case 'jump':
        this.tone(69, time, 0.16, 0.12, 'sine', 'effects', 0.005, 5000, 0, 0, 81);
        break;
      case 'double':
        this.tone(76, time, 0.19, 0.1, 'triangle', 'effects', 0.005, 5000, -0.2, 0, 88);
        this.tone(81, time + 0.045, 0.2, 0.07, 'sine', 'effects', 0.005, 5000, 0.2, 0, 93);
        break;
      case 'dash':
        this.noise(time, 0.25, 0.13, 1800, 'bandpass');
        this.tone(48, time, 0.22, 0.16, 'sawtooth', 'effects', 0.008, 1200, 0, 0, 72);
        break;
      case 'star':
        this.woodCrack(time);
        break;
      case 'pixie':
        [86, 90, 93].forEach((note, i) => this.tone(note, time + i * 0.045, 0.18, 0.075, 'sine', 'effects', 0.004, 7000, (i - 1) * 0.3));
        break;
      case 'death':
        this.playRecording('death', time);
        break;
    }
  }
}
