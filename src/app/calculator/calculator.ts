import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type WatchMode = 'TIME' | 'CALC' | 'SCI';
type CalcOperator = '+' | '-' | '×' | '÷';
type ScientificFunction = 'EXP' | 'SQRT' | 'LN';
type Operator = CalcOperator | ScientificFunction;
type Operation = {
  calculate: (op1: number, op2: number) => number;
  validate?: (op1: number, op2: number) => boolean;
};

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

  // Real-time Clock
  readonly currentTime = signal<Date>(new Date());
  readonly is24Hour = signal<boolean>(true);
  private clockInterval?: any;

  // Calculator State
  readonly calcDisplay = signal<string>('0');
  readonly prevOperand = signal<number | null>(null);
  readonly activeOperator = signal<Operator | null>(null);
  readonly waitingForNextOperand = signal<boolean>(false);
  readonly isError = signal<boolean>(false);

  // Audio Context for vintage piezo beeps
  private audioCtx?: AudioContext;

  // Active key highlight for press feedback
  readonly activePressedKey = signal<string | null>(null);

  private readonly operations: Record<Operator, Operation> = {
    '+': {
      calculate: (op1, op2) => op1 + op2,
    },
    '-': {
      calculate: (op1, op2) => op1 - op2,
    },
    '×': {
      calculate: (op1, op2) => op1 * op2,
    },
    '÷': {
      validate: (_op1, op2) => op2 !== 0,
      calculate: (op1, op2) => op1 / op2,
    },
    EXP: {
      calculate: (op1, op2) => Math.pow(op1, op2),
    },
    SQRT: {
      validate: (op1) => op1 >= 0,
      calculate: (op1) => Math.sqrt(op1),
    },
    LN: {
      validate: (op1) => op1 > 0,
      calculate: (op1) => Math.log(op1),
    },
  };

  ngOnInit() {
    // Start clock timer
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.audioCtx) this.audioCtx.close();
  }

  // Web Audio Piezo BEEP generator
  playSound(type: 'beep' | 'mode' | 'light' = 'beep') {
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

  // Cycle Watch Modes (TIME -> CALC -> SCI -> TIME)
  cycleMode() {
    const modes: WatchMode[] = ['TIME', 'CALC', 'SCI'];
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

  // Scientific sidecar button click handler (stub left for custom math implementation)
  onSciButtonClick(fn: ScientificFunction) {
    this.playSound('beep');
    this.activePressedKey.set(fn);
    setTimeout(() => this.activePressedKey.set(null), 150);
    this.handleCalcKey(fn);
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

    if (this.currentMode() === 'CALC' || this.currentMode() === 'SCI') {
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
    }
  }

  // Handle Button / Keypad Press
  pressKey(keyLabel: string) {
    this.activePressedKey.set(keyLabel);
    setTimeout(() => this.activePressedKey.set(null), 150);

    if (this.currentMode() === 'CALC' || this.currentMode() === 'SCI') {
      this.handleCalcKey(keyLabel);
    } else if (this.currentMode() === 'TIME') {
      this.handleTimeKey(keyLabel);
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
        } else if (current.length < 8) {
          // max 8 digits LCD
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
    } else if (['+', '-', '×', '÷', 'EXP'].includes(key)) {
      const currentValue = parseFloat(this.calcDisplay());
      if (this.prevOperand() !== null && this.activeOperator() && !this.waitingForNextOperand()) {
        const result = this.calculateResult(
          this.prevOperand()!,
          currentValue,
          this.activeOperator()!,
        );
        this.calcDisplay.set(this.formatResult(result));
        this.prevOperand.set(result);
      } else {
        this.prevOperand.set(currentValue);
      }
      this.activeOperator.set(key as Operator);
      this.waitingForNextOperand.set(true);
    } else if (key === 'SQRT' || key === 'LN') {
      const currentValue = parseFloat(this.calcDisplay());
      const result = this.calculateResult(currentValue, 0, key as Operator);
      this.calcDisplay.set(this.formatResult(result));
      this.waitingForNextOperand.set(true);
    } else if (key === '=') {
      if (this.prevOperand() !== null && this.activeOperator()) {
        const currentValue = parseFloat(this.calcDisplay());
        const result = this.calculateResult(
          this.prevOperand()!,
          currentValue,
          this.activeOperator()!,
        );
        this.calcDisplay.set(this.formatResult(result));
        this.prevOperand.set(null);
        this.activeOperator.set(null);
        this.waitingForNextOperand.set(true);
      }
    } else if (key === 'C' || key === 'AC') {
      this.clearCalc();
    }
  }

  private calculateResult(op1: number, op2: number, operator: Operator): number {
    const operation = this.operations[operator];
    const isValidInput =
      Number.isFinite(op1) && Number.isFinite(op2) && (operation.validate?.(op1, op2) ?? true);

    if (!isValidInput) {
      this.isError.set(true);
      return 0;
    }

    const result = operation.calculate(op1, op2);

    if (!Number.isFinite(result)) {
      this.isError.set(true);
      return 0;
    }

    return result;
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
}
