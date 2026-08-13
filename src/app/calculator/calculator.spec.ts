import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Calculator } from './calculator';

describe('Calculator Component', () => {
  let component: Calculator;
  let fixture: ComponentFixture<Calculator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calculator],
    }).compileComponents();

    fixture = TestBed.createComponent(Calculator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the calculator component', () => {
    expect(component).toBeTruthy();
  });

  describe('Watch Modes & Navigation', () => {
    it('should initialize in TIME mode', () => {
      expect(component.currentMode()).toBe('TIME');
    });

    it('should cycle between TIME, CALC, and SCI modes', () => {
      expect(component.currentMode()).toBe('TIME');
      component.cycleMode();
      expect(component.currentMode()).toBe('CALC');
      component.cycleMode();
      expect(component.currentMode()).toBe('SCI');
      component.cycleMode();
      expect(component.currentMode()).toBe('TIME');
    });

    it('should toggle EL backlight state', () => {
      expect(component.lightActive()).toBe(false);
      component.toggleLight();
      expect(component.lightActive()).toBe(true);
      component.toggleLight();
      expect(component.lightActive()).toBe(false);
    });

    it('should toggle sound enable state', () => {
      expect(component.soundEnabled()).toBe(true);
      component.toggleSound();
      expect(component.soundEnabled()).toBe(false);
    });

    it('should play sound on scientific sidecar button clicks', () => {
      const spy = vi.spyOn(component, 'playSound');
      component.onSciButtonClick('EXP');
      expect(spy).toHaveBeenCalledWith('beep');
    });
  });

  describe('Calculator Engine Operations', () => {
    beforeEach(() => {
      component.currentMode.set('CALC');
    });

    it('should enter multi-digit numbers and decimals', () => {
      component.pressKey('1');
      component.pressKey('2');
      component.pressKey('.');
      component.pressKey('5');
      expect(component.calcDisplay()).toBe('12.5');
    });

    it('should execute addition: 12 + 34 = 46', () => {
      component.pressKey('1');
      component.pressKey('2');
      component.pressKey('+');
      component.pressKey('3');
      component.pressKey('4');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('46');
    });

    it('should execute subtraction: 100 - 42 = 58', () => {
      component.pressKey('1');
      component.pressKey('0');
      component.pressKey('0');
      component.pressKey('-');
      component.pressKey('4');
      component.pressKey('2');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('58');
    });

    it('should execute multiplication: 7 × 8 = 56', () => {
      component.pressKey('7');
      component.pressKey('×');
      component.pressKey('8');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('56');
    });

    it('should execute division: 99 ÷ 3 = 33', () => {
      component.pressKey('9');
      component.pressKey('9');
      component.pressKey('÷');
      component.pressKey('3');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('33');
    });

    it('should handle divide-by-zero error', () => {
      component.pressKey('9');
      component.pressKey('÷');
      component.pressKey('0');
      component.pressKey('=');
      expect(component.isError()).toBe(true);
      expect(component.calcDisplay()).toBe('E');
    });

    it('should clear calculation state on C key', () => {
      component.pressKey('5');
      component.pressKey('+');
      component.pressKey('5');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('10');

      component.pressKey('C');
      expect(component.calcDisplay()).toBe('0');
      expect(component.prevOperand()).toBeNull();
      expect(component.activeOperator()).toBeNull();
      expect(component.isError()).toBe(false);
    });

    it('should limit display to maximum 8 digits', () => {
      for (let i = 0; i < 12; i++) {
        component.pressKey('9');
      }
      expect(component.calcDisplay().length).toBe(8);
      expect(component.calcDisplay()).toBe('99999999');
    });
  });

  describe('Scientific Mode Operations', () => {
    beforeEach(() => {
      component.currentMode.set('SCI');
    });

    it('should execute binary exponent operation (EXP): 2 ^ 3 = 8', () => {
      component.pressKey('2');
      component.onSciButtonClick('EXP');
      component.pressKey('3');
      component.pressKey('=');
      expect(component.calcDisplay()).toBe('8');
    });

    it('should immediately execute unary square root (SQRT): √16 = 4', () => {
      component.pressKey('1');
      component.pressKey('6');
      component.onSciButtonClick('SQRT');
      expect(component.calcDisplay()).toBe('4');
    });

    it('should handle SQRT error on negative input', () => {
      component.calcDisplay.set('-4');
      component.onSciButtonClick('SQRT');
      expect(component.isError()).toBe(true);
      expect(component.calcDisplay()).toBe('E');
    });

    it('should immediately execute unary natural log (LN): ln(1) = 0', () => {
      component.pressKey('1');
      component.onSciButtonClick('LN');
      expect(component.calcDisplay()).toBe('0');
    });

    it('should handle LN error on non-positive input', () => {
      component.pressKey('0');
      component.onSciButtonClick('LN');
      expect(component.isError()).toBe(true);
      expect(component.calcDisplay()).toBe('E');
    });
  });

  describe('Keyboard Event Listener', () => {
    it('should handle keyboard mode and light shortcuts', () => {
      const modeEvent = new KeyboardEvent('keydown', { key: 'm' });
      window.dispatchEvent(modeEvent);
      expect(component.currentMode()).toBe('CALC');

      const lightEvent = new KeyboardEvent('keydown', { key: 'l' });
      window.dispatchEvent(lightEvent);
      expect(component.lightActive()).toBe(true);
    });

    it('should handle keyboard inputs in CALC mode', () => {
      component.currentMode.set('CALC');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '7' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(component.calcDisplay()).toBe('12');
    });
  });
});
