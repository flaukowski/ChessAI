import { describe, it, expect, beforeEach } from 'vitest';
import { EchoEffect, EchoParams } from '../../lib/dsp/effects/echo';

describe('EchoEffect', () => {
  let echo: EchoEffect;
  const sampleRate = 48000;

  beforeEach(() => {
    echo = new EchoEffect(sampleRate);
  });

  describe('initialization', () => {
    it('should create with default sample rate', () => {
      const defaultEcho = new EchoEffect();
      expect(defaultEcho).toBeDefined();
    });

    it('should create with custom sample rate', () => {
      const customEcho = new EchoEffect(44100);
      expect(customEcho).toBeDefined();
    });

    it('should have default parameters', () => {
      const params = echo.getParams();
      expect(params.delayMs).toBe(300);
      expect(params.feedback).toBe(0.5);
      expect(params.lfoMs).toBe(0);
      expect(params.mix).toBe(0.5);
    });
  });

  describe('setParams', () => {
    it('should update delay time', () => {
      echo.setParams({ delayMs: 500 });
      expect(echo.getParams().delayMs).toBe(500);
    });

    it('should update feedback', () => {
      echo.setParams({ feedback: 0.8 });
      expect(echo.getParams().feedback).toBe(0.8);
    });

    it('should update mix', () => {
      echo.setParams({ mix: 0.75 });
      expect(echo.getParams().mix).toBe(0.75);
    });

    it('should update lfoMs', () => {
      echo.setParams({ lfoMs: 2 });
      expect(echo.getParams().lfoMs).toBe(2);
    });

    it('should allow partial updates', () => {
      echo.setParams({ delayMs: 100, feedback: 0.3 });
      const params = echo.getParams();
      expect(params.delayMs).toBe(100);
      expect(params.feedback).toBe(0.3);
      expect(params.mix).toBe(0.5);
    });
  });

  describe('process', () => {
    it('should pass through dry signal when mix is 0', () => {
      echo.setParams({ mix: 0 });
      
      const output = echo.process(0.5);
      expect(output).toBeCloseTo(0.5, 5);
    });

    it('should output wet signal when mix is 1', () => {
      echo.setParams({ mix: 1, delayMs: 10 });
      echo.reset();

      const output = echo.process(0.8);
      expect(output).toBeLessThan(0.8);
    });

    it('should produce output in valid range', () => {
      for (let i = 0; i < 1000; i++) {
        const input = Math.sin(2 * Math.PI * i / 100);
        const output = echo.process(input);
        expect(output).not.toBeNaN();
        expect(Math.abs(output)).toBeLessThanOrEqual(2);
      }
    });

    it('should produce delayed signal after delay time', () => {
      echo.setParams({ delayMs: 10, feedback: 0.5, mix: 0.5 });
      echo.reset();

      const outputs: number[] = [];
      echo.process(1.0);

      for (let i = 0; i < 1000; i++) {
        outputs.push(echo.process(0));
      }

      const maxOutput = Math.max(...outputs.map(Math.abs));
      expect(maxOutput).toBeGreaterThan(0.01);
    });

    it('should produce feedback echoes', () => {
      echo.setParams({ delayMs: 10, feedback: 0.7, mix: 0.5 });
      echo.reset();

      echo.process(1.0);

      const outputs: number[] = [];
      for (let i = 0; i < 5000; i++) {
        outputs.push(echo.process(0));
      }

      const nonZeroCount = outputs.filter(o => Math.abs(o) > 0.00001).length;
      expect(nonZeroCount).toBeGreaterThan(0);
    });
  });

  describe('processBlock', () => {
    it('should process a block of samples', () => {
      const blockSize = 128;
      const input = new Float32Array(blockSize);
      const output = new Float32Array(blockSize);

      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }

      echo.processBlock(input, output);

      for (let i = 0; i < blockSize; i++) {
        expect(output[i]).not.toBeNaN();
      }
    });

    it('should produce same result as calling process individually', () => {
      const blockSize = 64;
      const input = new Float32Array(blockSize);
      const outputBlock = new Float32Array(blockSize);

      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }

      echo.reset();
      echo.processBlock(input, outputBlock);

      const echo2 = new EchoEffect(sampleRate);
      echo2.setParams(echo.getParams());
      echo2.reset();

      for (let i = 0; i < blockSize; i++) {
        const singleOutput = echo2.process(input[i]);
        expect(outputBlock[i]).toBeCloseTo(singleOutput, 5);
      }
    });
  });

  describe('reset', () => {
    it('should clear internal state', () => {
      for (let i = 0; i < 100; i++) {
        echo.process(Math.random());
      }

      echo.reset();

      echo.setParams({ mix: 1, delayMs: 1 });
      const output = echo.process(0);

      expect(Math.abs(output)).toBeLessThan(0.5);
    });
  });

  describe('getParams', () => {
    it('should return a copy of parameters', () => {
      const params1 = echo.getParams();
      const params2 = echo.getParams();

      params1.delayMs = 999;
      expect(echo.getParams().delayMs).toBe(300);
      expect(params2.delayMs).toBe(300);
    });
  });

  describe('audio characteristics', () => {
    it('should produce smoother output with longer delay', () => {
      echo.setParams({ delayMs: 100, feedback: 0.5, mix: 0.5 });
      echo.reset();

      let energy = 0;
      for (let i = 0; i < 1000; i++) {
        const input = i === 0 ? 1.0 : 0;
        const output = echo.process(input);
        energy += output * output;
      }

      expect(energy).toBeGreaterThan(0);
    });

    it('should decay with feedback less than 1', () => {
      echo.setParams({ delayMs: 10, feedback: 0.5, mix: 1 });
      echo.reset();

      echo.process(1.0);

      let prevAmplitude = Infinity;
      for (let cycle = 0; cycle < 5; cycle++) {
        let maxAmplitude = 0;
        for (let i = 0; i < 1000; i++) {
          const output = Math.abs(echo.process(0));
          maxAmplitude = Math.max(maxAmplitude, output);
        }
        if (cycle > 0 && maxAmplitude > 0.001) {
          expect(maxAmplitude).toBeLessThan(prevAmplitude);
        }
        prevAmplitude = maxAmplitude;
      }
    });
  });
});
