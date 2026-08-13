import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type WatchMode = 'TIME' | 'CALC' | 'ALARM' | 'STOPWATCH' | 'DUAL_TIME';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.html',
  styleUrl: './calculator.css',
})
export class Calculator implements OnInit, OnDestroy {
  // Watch State Signals
  readonly currentMode = signal<WatchMode>('TIME');
  readonly soundEnabled = signal<boolean>(true);
  readonly lightActive = signal<boolean>(false);
  readonly wristView = signal<boolean>(false);

  // Real-time Clock
  readonly currentTime = signal<Date>(new Date());
  readonly is24Hour = signal<boolean>(true);
  private clockInterval?: any;

  // Calculator State
  readonly calcDisplay = signal<string>('0');
  readonly prevOperand = signal<number | null>(null);
  readonly activeOperator = signal<string | null>(null);
  readonly waitingForNextOperand = signal<boolean>(false);
  readonly isError = signal<boolean>(false);

  // Stopwatch State
  readonly swRunning = signal<boolean>(false);
  readonly swElapsedMs = signal<number>(0);
  readonly swSplitMs = signal<number | null>(null);
  private swInterval?: any;

  // Alarm State
  readonly alarmHours = signal<number>(7);
  readonly alarmMinutes = signal<number>(0);
  readonly alarmEnabled = signal<boolean>(true);
  readonly hourlyChime = signal<boolean>(true);
  readonly isAlarmRinging = signal<boolean>(false);
  private alarmCheckInterval?: any;

  // Dual Time State
  readonly dtOffsetHours = signal<number>(5); // e.g. +5 hours offset

  // Audio Context for vintage piezo beeps
  private audioCtx?: AudioContext;

  // Active key highlight for press feedback
  readonly activePressedKey = signal<string | null>(null);

  ngOnInit() {
    // Start clock timer
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Alarm checker interval
    this.alarmCheckInterval = setInterval(() => {
      this.checkAlarm();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.swInterval) clearInterval(this.swInterval);
    if (this.alarmCheckInterval) clearInterval(this.alarmCheckInterval);
    if (this.audioCtx) this.audioCtx.close();
  }

  // Web Audio Piezo BEEP generator
  playSound(type: 'beep' | 'mode' | 'alarm' | 'error' | 'light' = 'beep') {
    if (!this.soundEnabled()) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'beep') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(2048, now); // Retro 2kHz Casio beep
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'mode') {
        // High double beep for mode switch
        osc.type = 'square';
        osc.frequency.setValueAtTime(2730, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(3200, now + 0.05);
        gain2.gain.setValueAtTime(0.08, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.09);
      } else if (type === 'alarm') {
        // Classic Casio alarm chirp
        for (let i = 0; i < 4; i++) {
          const chirpOsc = this.audioCtx.createOscillator();
          const chirpGain = this.audioCtx.createGain();
          chirpOsc.connect(chirpGain);
          chirpGain.connect(this.audioCtx.destination);
          chirpOsc.type = 'square';
          chirpOsc.frequency.setValueAtTime(4096, now + i * 0.12);
          chirpGain.gain.setValueAtTime(0.12, now + i * 0.12);
          chirpGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.06);
          chirpOsc.start(now + i * 0.12);
          chirpOsc.stop(now + i * 0.12 + 0.06);
        }
      } else if (type === 'light') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      }
    } catch (e) {
      // Audio fallback silent
    }
  }

  // Cycle Watch Modes
  cycleMode() {
    const modes: WatchMode[] = ['TIME', 'CALC', 'ALARM', 'STOPWATCH', 'DUAL_TIME'];
    const currentIndex = modes.indexOf(this.currentMode());
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.currentMode.set(nextMode);
    this.playSound('mode');
  }

  toggleLight() {
    this.lightActive.set(!this.lightActive());
    this.playSound('light');
  }

  toggleSound() {
    this.soundEnabled.set(!this.soundEnabled());
  }

  toggleWristView() {
    this.wristView.set(!this.wristView());
  }

  // Keyboard Shortcuts HostListener
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = event.key;

    if (key === 'm' || key === 'M') {
      event.preventDefault();
      this.cycleMode();
      return;
    }
    if (key === 'l' || key === 'L') {
      event.preventDefault();
      this.toggleLight();
      return;
    }

    if (this.currentMode() === 'CALC') {
      if ('0123456789.'.includes(key)) {
        event.preventDefault();
        this.pressKey(key);
      } else if (key === '+' || key === '-') {
        event.preventDefault();
        this.pressKey(key);
      } else if (key === '*') {
        event.preventDefault();
        this.pressKey('×');
      } else if (key === '/') {
        event.preventDefault();
        this.pressKey('÷');
      } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        this.pressKey('=');
      } else if (key === 'Backspace' || key === 'Escape' || key === 'c' || key === 'C') {
        event.preventDefault();
        this.pressKey('C');
      }
    } else if (this.currentMode() === 'STOPWATCH') {
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        this.toggleStopwatch();
      } else if (key === 'r' || key === 'R' || key === 'Escape') {
        event.preventDefault();
        this.resetStopwatch();
      }
    }
  }

  // Handle Button / Keypad Press
  pressKey(keyLabel: string) {
    this.activePressedKey.set(keyLabel);
    setTimeout(() => this.activePressedKey.set(null), 150);

    const mode = this.currentMode();

    if (mode === 'CALC') {
      this.handleCalcKey(keyLabel);
    } else if (mode === 'TIME') {
      this.handleTimeKey(keyLabel);
    } else if (mode === 'ALARM') {
      this.handleAlarmKey(keyLabel);
    } else if (mode === 'STOPWATCH') {
      this.handleStopwatchKey(keyLabel);
    } else if (mode === 'DUAL_TIME') {
      this.handleDualTimeKey(keyLabel);
    }
  }

  // Calculator Mode Logic
  private handleCalcKey(key: string) {
    this.playSound('beep');

    if (this.isError()) {
      if (key === 'C' || key === 'AC' || key === '+') {
        this.clearCalc();
      }
      return;
    }

    if (!isNaN(Number(key))) {
      // Digit press
      if (this.waitingForNextOperand()) {
        this.calcDisplay.set(key);
        this.waitingForNextOperand.set(false);
      } else {
        const current = this.calcDisplay();
        if (current === '0') {
          this.calcDisplay.set(key);
        } else if (current.length < 8) { // max 8 digits LCD
          this.calcDisplay.set(current + key);
        }
      }
    } else if (key === '.') {
      if (this.waitingForNextOperand()) {
        this.calcDisplay.set('0.');
        this.waitingForNextOperand.set(false);
      } else if (!this.calcDisplay().includes('.')) {
        this.calcDisplay.set(this.calcDisplay() + '.');
      }
    } else if (['+', '-', '×', '÷'].includes(key)) {
      const currentValue = parseFloat(this.calcDisplay());
      if (this.prevOperand() !== null && this.activeOperator() && !this.waitingForNextOperand()) {
        const result = this.calculateResult(this.prevOperand()!, currentValue, this.activeOperator()!);
        this.calcDisplay.set(this.formatResult(result));
        this.prevOperand.set(result);
      } else {
        this.prevOperand.set(currentValue);
      }
      this.activeOperator.set(key);
      this.waitingForNextOperand.set(true);
    } else if (key === '=') {
      if (this.prevOperand() !== null && this.activeOperator()) {
        const currentValue = parseFloat(this.calcDisplay());
        const result = this.calculateResult(this.prevOperand()!, currentValue, this.activeOperator()!);
        this.calcDisplay.set(this.formatResult(result));
        this.prevOperand.set(null);
        this.activeOperator.set(null);
        this.waitingForNextOperand.set(true);
      }
    } else if (key === 'C' || key === 'AC') {
      this.clearCalc();
    }
  }

  private calculateResult(op1: number, op2: number, operator: string): number {
    let res = 0;
    switch (operator) {
      case '+': res = op1 + op2; break;
      case '-': res = op1 - op2; break;
      case '×': res = op1 * op2; break;
      case '÷':
        if (op2 === 0) {
          this.isError.set(true);
          return 0;
        }
        res = op1 / op2;
        break;
    }
    return res;
  }

  private formatResult(num: number): string {
    if (this.isError() || isNaN(num) || !isFinite(num)) {
      this.isError.set(true);
      return 'E';
    }
    if (Math.abs(num) >= 1e8) {
      this.isError.set(true);
      return 'E';
    }

    let str = num.toString();
    if (str.length > 8) {
      const precision = 8 - Math.floor(Math.abs(num)).toString().length - (num < 0 ? 1 : 0);
      str = num.toFixed(Math.max(0, Math.min(6, precision)));
      if (str.includes('.')) {
        str = str.replace(/\.?0+$/, '');
      }
    }
    return str.substring(0, 8);
  }

  clearCalc() {
    this.calcDisplay.set('0');
    this.prevOperand.set(null);
    this.activeOperator.set(null);
    this.waitingForNextOperand.set(false);
    this.isError.set(false);
  }

  // Time Mode Handlers
  private handleTimeKey(key: string) {
    this.playSound('beep');
    if (key === '8' || key === '24H') {
      this.is24Hour.set(!this.is24Hour());
    }
  }

  // Alarm Mode Handlers
  private handleAlarmKey(key: string) {
    this.playSound('beep');
    if (key === '9' || key === 'ALM') {
      this.alarmEnabled.set(!this.alarmEnabled());
    } else if (key === '5' || key === 'SIG') {
      this.hourlyChime.set(!this.hourlyChime());
    } else if (key === '1' || key === '+') {
      let m = (this.alarmMinutes() + 5) % 60;
      this.alarmMinutes.set(m);
    } else if (key === '2' || key === '-') {
      let h = (this.alarmHours() + 1) % 24;
      this.alarmHours.set(h);
    }
  }

  private checkAlarm() {
    if (!this.alarmEnabled()) return;
    const now = this.currentTime();
    if (now.getHours() === this.alarmHours() && now.getMinutes() === this.alarmMinutes() && now.getSeconds() === 0) {
      this.isAlarmRinging.set(true);
      this.playSound('alarm');
      setTimeout(() => this.isAlarmRinging.set(false), 5000);
    }
  }

  // Stopwatch Mode Handlers
  private handleStopwatchKey(key: string) {
    this.playSound('beep');
    if (key === '7' || key === '1' || key === 'ST') {
      this.toggleStopwatch();
    } else if (key === '4' || key === '0' || key === 'R') {
      this.resetStopwatch();
    }
  }

  toggleStopwatch() {
    if (this.swRunning()) {
      clearInterval(this.swInterval);
      this.swRunning.set(false);
    } else {
      this.swRunning.set(true);
      const startTime = Date.now() - this.swElapsedMs();
      this.swInterval = setInterval(() => {
        this.swElapsedMs.set(Date.now() - startTime);
      }, 10);
    }
  }

  resetStopwatch() {
    clearInterval(this.swInterval);
    this.swRunning.set(false);
    this.swElapsedMs.set(0);
    this.swSplitMs.set(null);
  }

  // Dual Time Handlers
  private handleDualTimeKey(key: string) {
    this.playSound('beep');
    if (key === '+' || key === '1') {
      this.dtOffsetHours.set((this.dtOffsetHours() + 1) % 24);
    } else if (key === '-' || key === '2') {
      this.dtOffsetHours.set((this.dtOffsetHours() - 1 + 24) % 24);
    }
  }

  // Format Helpers for Display
  readonly formattedDayOfWeek = computed(() => {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    return days[this.currentTime().getDay()];
  });

  readonly formattedMonthDate = computed(() => {
    const d = this.currentTime();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const date = d.getDate().toString().padStart(2, '0');
    return `${month}-${date}`;
  });

  readonly formattedTimeHours = computed(() => {
    const d = this.currentTime();
    let hours = d.getHours();
    if (!this.is24Hour()) {
      hours = hours % 12 || 12;
    }
    return hours.toString().padStart(2, '0');
  });

  readonly formattedTimeMinutes = computed(() => {
    return this.currentTime().getMinutes().toString().padStart(2, '0');
  });

  readonly formattedTimeSeconds = computed(() => {
    return this.currentTime().getSeconds().toString().padStart(2, '0');
  });

  readonly isPm = computed(() => {
    return this.currentTime().getHours() >= 12;
  });

  readonly formattedStopwatchDisplay = computed(() => {
    const totalMs = this.swElapsedMs();
    const mins = Math.floor(totalMs / 60000).toString().padStart(2, '0');
    const secs = Math.floor((totalMs % 60000) / 1000).toString().padStart(2, '0');
    const cs = Math.floor((totalMs % 1000) / 10).toString().padStart(2, '0');
    return { mins, secs, cs };
  });

  readonly formattedAlarmDisplay = computed(() => {
    const h = this.alarmHours().toString().padStart(2, '0');
    const m = this.alarmMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  });

  readonly formattedDualTimeDisplay = computed(() => {
    const d = new Date(this.currentTime().getTime() + this.dtOffsetHours() * 3600000);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  });
}
