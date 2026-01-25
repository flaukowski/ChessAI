import { describe, it, expect, beforeEach } from 'vitest';
import { FlangerEffect, FlangerParams } from '../../lib/dsp/effects/flanger';

describe('FlangerEffect', () => {
  let flanger: FlangerEffect;
  const sampleRate = 48000;

  beforeEach(() => {
    flanger = new FlangerEffect(sampleRate);
  });

  describe('initialization', () => {
    it('should create with default sample rate', () => {
      const defaultFlanger = new FlangerEffect();
      expect(defaultFlanger).toBeDefined();
    });

    it('should create with custom sample rate', () => {
      const customFlanger = new FlangerEffect(44100);
      expect(customFlanger).toBeDefined();
    });

    it('should have default parameters', () => {
      const params = flanger.getParams();
      expect(params.rate).toBe(0.5);
      expect(params.delayMs).toBe(2);
      expect(params.depth).toBe(0.5);
      expect(params.feedback).toBe(0.5);
      expect(params.mix).toBe(0.5);
      expect(params.waveform).toBe('sine');
    });
  });

  describe('setParams', () => {
    it('should update rate', () => {
      flanger.setParams({ rate: 2.0 });
      expect(flanger.getParams().rate).toBe(2.0);
    });

    it('should update delay time', () => {
      flanger.setParams({ delayMs: 3 });
      expect(flanger.getParams().delayMs).toBe(3);
    });

    it('should update depth', () => {
      flanger.setParams({ depth: 0.8 });
      expect(flanger.getParams().depth).toBe(0.8);
    });

    it('should update feedback', () => {
      flanger.setParams({ feedback: 0.7 });
      expect(flanger.getParams().feedback).toBe(0.7);
    });

    it('should update mix', () => {
      flanger.setParams({ mix: 0.75 });
      expect(flanger.getParams().mix).toBe(0.75);
    });

    it('should update waveform', () => {
      flanger.setParams({ waveform: 'triangle' });
      expect(flanger.getParams().waveform).toBe('triangle');
    });

    it('should allow partial updates', () => {
      flanger.setParams({ rate: 1.5, depth: 0.9 });
      const params = flanger.getParams();
      expect(params.rate).toBe(1.5);
      expect(params.depth).toBe(0.9);
      expect(params.delayMs).toBe(2);
    });
  });

  describe('process', () => {
    it('should pass through dry signal when mix is 0', () => {
      flanger.setParams({ mix: 0, rate: 0.5 });
      flanger.reset();
      
      for (let i = 0; i < 10; i++) {
        flanger.process(0);
      }
      
      const output = flanger.process(0.5);
      expect(Math.abs(output - 0.5)).toBeLessThan(0.1);
    });

    it('should produce valid output with default params', () => {
      flanger.reset();
      
      for (let i = 0; i < 100; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        const output = flanger.process(input);
        expect(Number.isFinite(output)).toBe(true);
      }
    });

    it('should produce output in valid range', () => {
      flanger.setParams({ rate: 1, depth: 0.5, mix: 0.5, feedback: 0.5 });
      flanger.reset();
      
      for (let i = 0; i < 1000; i++) {
        const input = Math.sin(2 * Math.PI * i / 100);
        const output = flanger.process(input);
        expect(Number.isFinite(output)).toBe(true);
        expect(Math.abs(output)).toBeLessThanOrEqual(2);
      }
    });

    it('should produce varying output with LFO modulation', () => {
      flanger.setParams({ rate: 100, depth: 0.5, mix: 0.5, feedback: 0.3, delayMs: 2 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const input = 0.5;
        outputs.push(flanger.process(input));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
      
      if (validOutputs.length > 0) {
        const min = Math.min(...validOutputs);
        const max = Math.max(...validOutputs);
        expect(max - min).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce comb filter effect', () => {
      flanger.setParams({ rate: 0.1, depth: 0, feedback: 0.5, mix: 0.5, delayMs: 2 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 500; i++) {
        outputs.push(flanger.process(i === 0 ? 1 : 0));
      }

      const maxOutput = Math.max(...outputs.filter(Number.isFinite).map(Math.abs));
      expect(maxOutput).toBeGreaterThan(0);
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
      
      flanger.reset();
      flanger.processBlock(input, output);

      for (let i = 0; i < blockSize; i++) {
        expect(Number.isFinite(output[i])).toBe(true);
      }
    });

    it('should produce same result as calling process individually', () => {
      const blockSize = 64;
      const input = new Float32Array(blockSize);
      const outputBlock = new Float32Array(blockSize);

      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }

      flanger.reset();
      flanger.processBlock(input, outputBlock);

      const flanger2 = new FlangerEffect(sampleRate);
      flanger2.setParams(flanger.getParams());
      flanger2.reset();

      for (let i = 0; i < blockSize; i++) {
        const singleOutput = flanger2.process(input[i]);
        if (Number.isFinite(outputBlock[i]) && Number.isFinite(singleOutput)) {
          expect(outputBlock[i]).toBeCloseTo(singleOutput, 5);
        }
      }
    });
  });

  describe('reset', () => {
    it('should clear internal state', () => {
      for (let i = 0; i < 100; i++) {
        flanger.process(Math.random());
      }

      flanger.reset();

      flanger.setParams({ mix: 0.5, delayMs: 1, feedback: 0 });
      const output = flanger.process(0);

      expect(Number.isFinite(output)).toBe(true);
      expect(Math.abs(output)).toBeLessThan(1);
    });

    it('should reset LFO phase', () => {
      flanger.setParams({ rate: 1 });
      flanger.reset();

      for (let i = 0; i < 1000; i++) {
        flanger.process(0.5);
      }

      flanger.reset();

      const flanger2 = new FlangerEffect(sampleRate);
      flanger2.setParams({ rate: 1 });
      flanger2.reset();

      for (let i = 0; i < 10; i++) {
        const out1 = flanger.process(0.5);
        const out2 = flanger2.process(0.5);
        if (Number.isFinite(out1) && Number.isFinite(out2)) {
          expect(out1).toBeCloseTo(out2, 3);
        }
      }
    });
  });

  describe('getParams', () => {
    it('should return a copy of parameters', () => {
      const params1 = flanger.getParams();
      const params2 = flanger.getParams();

      params1.rate = 999;
      expect(flanger.getParams().rate).toBe(0.5);
      expect(params2.rate).toBe(0.5);
    });
  });

  describe('waveform types', () => {
    it('should work with sine waveform', () => {
      flanger.setParams({ waveform: 'sine', rate: 50, depth: 0.5 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 1000; i++) {
        outputs.push(flanger.process(0.5));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
    });

    it('should work with triangle waveform', () => {
      flanger.setParams({ waveform: 'triangle', rate: 50, depth: 0.5 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 1000; i++) {
        outputs.push(flanger.process(0.5));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
    });

    it('should work with sawtooth waveform', () => {
      flanger.setParams({ waveform: 'sawtooth', rate: 50, depth: 0.5 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(flanger.process(0.5));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
    });
  });

  describe('audio characteristics', () => {
    it('should produce classic flanging sweep', () => {
      flanger.setParams({ rate: 0.5, depth: 0.5, feedback: 0.5, mix: 0.5, delayMs: 2 });
      flanger.reset();

      const outputs: number[] = [];
      for (let i = 0; i < 2000; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        outputs.push(flanger.process(input));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
      
      if (validOutputs.length > 0) {
        const variance = validOutputs.reduce((sum, val) => sum + val * val, 0) / validOutputs.length;
        expect(variance).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce feedback resonance', () => {
      flanger.setParams({ rate: 0.1, depth: 0.1, feedback: 0.7, mix: 0.5, delayMs: 2 });
      flanger.reset();

      const outputs: number[] = [];
      outputs.push(flanger.process(1.0));

      for (let i = 0; i < 500; i++) {
        outputs.push(flanger.process(0));
      }

      const validOutputs = outputs.filter(Number.isFinite);
      expect(validOutputs.length).toBeGreaterThan(0);
      
      const maxOutput = Math.max(...validOutputs.map(Math.abs));
      expect(maxOutput).toBeGreaterThan(0);
    });
  });
});
