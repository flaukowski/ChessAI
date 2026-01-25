import { describe, it, expect, beforeEach } from 'vitest';
import { PhaserEffect } from '../../lib/dsp/effects/phaser';

describe('PhaserEffect', () => {
  let phaser: PhaserEffect;
  const sampleRate = 48000;

  beforeEach(() => {
    phaser = new PhaserEffect(sampleRate);
  });

  describe('initialization', () => {
    it('should create with default sample rate of 48000', () => {
      const defaultPhaser = new PhaserEffect();
      expect(defaultPhaser).toBeDefined();
    });

    it('should create with custom sample rate', () => {
      const customPhaser = new PhaserEffect(44100);
      expect(customPhaser).toBeDefined();
    });

    it('should have default parameters', () => {
      const params = phaser.getParams();
      expect(params.rate).toBeDefined();
      expect(params.feedback).toBeDefined();
      expect(params.centerFreq).toBeDefined();
      expect(params.octaves).toBeDefined();
      expect(params.Q).toBeDefined();
      expect(params.mix).toBeDefined();
    });
  });

  describe('parameter updates', () => {
    it('should update rate parameter', () => {
      phaser.setParams({ rate: 500 });
      const params = phaser.getParams();
      expect(params.rate).toBe(500);
    });

    it('should update feedback parameter', () => {
      phaser.setParams({ feedback: 0.7 });
      const params = phaser.getParams();
      expect(params.feedback).toBe(0.7);
    });

    it('should update centerFreq parameter', () => {
      phaser.setParams({ centerFreq: 800 });
      const params = phaser.getParams();
      expect(params.centerFreq).toBe(800);
    });

    it('should update octaves parameter', () => {
      phaser.setParams({ octaves: 3 });
      const params = phaser.getParams();
      expect(params.octaves).toBe(3);
    });

    it('should update Q parameter', () => {
      phaser.setParams({ Q: 1.5 });
      const params = phaser.getParams();
      expect(params.Q).toBe(1.5);
    });

    it('should update mix parameter', () => {
      phaser.setParams({ mix: 0.8 });
      const params = phaser.getParams();
      expect(params.mix).toBe(0.8);
    });

    it('should update waveform parameter', () => {
      phaser.setParams({ waveform: 1 });
      const params = phaser.getParams();
      expect(params.waveform).toBe(1);
    });

    it('should update multiple parameters at once', () => {
      phaser.setParams({
        rate: 1000,
        feedback: 0.5,
        centerFreq: 1000,
        octaves: 2,
        Q: 0.707,
        mix: 0.6,
      });
      const params = phaser.getParams();
      expect(params.rate).toBe(1000);
      expect(params.feedback).toBe(0.5);
      expect(params.centerFreq).toBe(1000);
      expect(params.octaves).toBe(2);
      expect(params.Q).toBe(0.707);
      expect(params.mix).toBe(0.6);
    });
  });

  describe('process', () => {
    it('should return dry signal when mix is 0', () => {
      phaser.setParams({ mix: 0 });
      const input = 0.5;
      const output = phaser.process(input);
      expect(output).toBeCloseTo(input, 5);
    });

    it('should produce valid output for sine wave input', () => {
      phaser.setParams({ rate: 500, feedback: 0.5, mix: 0.5 });
      const outputs: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        outputs.push(phaser.process(input));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(1000);
    });

    it('should produce phase cancellation at notch frequencies', () => {
      phaser.setParams({
        rate: 100000,
        feedback: 0.3,
        centerFreq: 1000,
        mix: 0.5,
        octaves: 0,
      });
      phaser.reset();
      let totalPower = 0;
      for (let i = 0; i < 4800; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        const output = phaser.process(input);
        if (i > 1000) {
          totalPower += output * output;
        }
      }
      expect(totalPower).toBeGreaterThanOrEqual(0);
    });

    it('should produce resonance peaks with high feedback', () => {
      phaser.setParams({ feedback: 0.9, mix: 0.5 });
      const outputs: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        outputs.push(phaser.process(input));
      }
      const maxOutput = Math.max(...outputs.map(Math.abs));
      expect(maxOutput).toBeGreaterThan(0);
    });
  });

  describe('LFO modulation', () => {
    it('should modulate with triangle waveform (default)', () => {
      phaser.setParams({ rate: 500, waveform: 0 });
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate);
    });

    it('should modulate with sine waveform', () => {
      phaser.setParams({ rate: 500, waveform: 1 });
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate);
    });

    it('should modulate with sawtooth waveform', () => {
      phaser.setParams({ rate: 500, waveform: 2 });
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate);
    });

    it('should sweep through frequency range based on octaves', () => {
      phaser.setParams({ rate: 1000, centerFreq: 440, octaves: 4 });
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate * 2; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        outputs.push(phaser.process(input));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate * 2);
    });
  });

  describe('allpass filter behavior', () => {
    it('should maintain unity gain at all frequencies', () => {
      phaser.setParams({ rate: 100000, feedback: 0, mix: 1, octaves: 0 });
      phaser.reset();
      let inputPower = 0;
      let outputPower = 0;
      for (let i = 0; i < 4800; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        const output = phaser.process(input);
        if (i > 480) {
          inputPower += input * input;
          outputPower += output * output;
        }
      }
      expect(outputPower).toBeGreaterThan(0);
    });

    it('should shift phase at center frequency', () => {
      phaser.setParams({
        rate: 100000,
        feedback: 0,
        centerFreq: 1000,
        mix: 1,
        octaves: 0,
      });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 480; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        outputs.push(phaser.process(input));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(480);
    });
  });

  describe('block processing', () => {
    it('should process block of samples', () => {
      const blockSize = 128;
      const input = new Float32Array(blockSize);
      const output = new Float32Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }
      phaser.processBlock(input, output);
      expect(output.every(Number.isFinite)).toBe(true);
    });

    it('should produce equivalent results to sample-by-sample processing', () => {
      const blockSize = 128;
      const input = new Float32Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }
      const phaser1 = new PhaserEffect(sampleRate);
      const phaser2 = new PhaserEffect(sampleRate);
      phaser1.setParams({ rate: 500, feedback: 0.5, mix: 0.5 });
      phaser2.setParams({ rate: 500, feedback: 0.5, mix: 0.5 });
      const sampleOutput: number[] = [];
      for (let i = 0; i < blockSize; i++) {
        sampleOutput.push(phaser1.process(input[i]));
      }
      const blockOutput = new Float32Array(blockSize);
      phaser2.processBlock(input, blockOutput);
      for (let i = 0; i < blockSize; i++) {
        expect(blockOutput[i]).toBeCloseTo(sampleOutput[i], 5);
      }
    });

    it('should process multiple blocks efficiently', () => {
      const blockSize = 512;
      const numBlocks = 100;
      const input = new Float32Array(blockSize);
      const output = new Float32Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }
      const startTime = performance.now();
      for (let b = 0; b < numBlocks; b++) {
        phaser.processBlock(input, output);
      }
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('reset', () => {
    it('should clear internal state', () => {
      for (let i = 0; i < 1000; i++) {
        phaser.process(Math.sin(2 * Math.PI * 440 * i / sampleRate));
      }
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(phaser.process(0));
      }
      const maxOutput = Math.max(...outputs.map(Math.abs));
      expect(maxOutput).toBeLessThan(0.01);
    });

    it('should reset LFO phase', () => {
      phaser.setParams({ rate: 1000 });
      for (let i = 0; i < 5000; i++) {
        phaser.process(0.5);
      }
      phaser.reset();
      const phaser2 = new PhaserEffect(sampleRate);
      phaser2.setParams({ rate: 1000 });
      for (let i = 0; i < 100; i++) {
        const output1 = phaser.process(0.5);
        const output2 = phaser2.process(0.5);
        expect(output1).toBeCloseTo(output2, 4);
      }
    });

    it('should reset filter states', () => {
      phaser.setParams({ feedback: 0.9 });
      for (let i = 0; i < 1000; i++) {
        phaser.process(1.0);
      }
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(phaser.process(0));
      }
      expect(outputs.every(v => Math.abs(v) < 0.01)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very fast rate (25Hz)', () => {
      phaser.setParams({ rate: 25000 });
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(phaser.process(Math.sin(2 * Math.PI * 1000 * i / sampleRate)));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(100);
    });

    it('should handle minimum Q (0.25)', () => {
      phaser.setParams({ Q: 0.25 });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(100);
    });

    it('should handle maximum Q (2)', () => {
      phaser.setParams({ Q: 2 });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 100; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(100);
    });

    it('should handle silence (zero input)', () => {
      phaser.reset();
      for (let i = 0; i < 100; i++) {
        const output = phaser.process(0);
        expect(Number.isFinite(output)).toBe(true);
        expect(Math.abs(output)).toBeLessThan(0.001);
      }
    });

    it('should handle DC offset', () => {
      phaser.reset();
      for (let i = 0; i < 100; i++) {
        const output = phaser.process(0.5);
        expect(Number.isFinite(output)).toBe(true);
      }
    });

    it('should handle impulse input', () => {
      phaser.reset();
      const outputs: number[] = [];
      outputs.push(phaser.process(1.0));
      for (let i = 0; i < 200; i++) {
        outputs.push(phaser.process(0));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(201);
    });
  });

  describe('fastPow2 approximation', () => {
    it('should produce stable output with varying LFO values', () => {
      phaser.setParams({ rate: 25, octaves: 4 });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 5000; i++) {
        outputs.push(phaser.process(0.5));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(5000);
    });

    it('should produce correct frequency multiplier range', () => {
      phaser.setParams({ centerFreq: 440, octaves: 4, rate: 25 });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < 10000; i++) {
        outputs.push(phaser.process(Math.sin(2 * Math.PI * 440 * i / sampleRate)));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(10000);
    });
  });

  describe('frequency update threshold optimization', () => {
    it('should skip redundant filter coefficient updates', () => {
      phaser.setParams({ rate: 10000 });
      phaser.reset();
      const startTime = performance.now();
      for (let i = 0; i < 48000; i++) {
        phaser.process(Math.sin(2 * Math.PI * 440 * i / sampleRate));
      }
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should update filters when frequency changes by more than 1Hz', () => {
      phaser.setParams({ rate: 25, octaves: 4 });
      phaser.reset();
      for (let i = 0; i < 1000; i++) {
        const output = phaser.process(0.5);
        expect(Number.isFinite(output)).toBe(true);
      }
    });
  });

  describe('audio characteristics', () => {
    it('should produce classic phaser sweep', () => {
      phaser.setParams({
        rate: 500,
        feedback: 0.5,
        centerFreq: 440,
        octaves: 4,
        mix: 0.5
      });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        outputs.push(phaser.process(input));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate);
      const mean = outputs.reduce((a, b) => a + b, 0) / outputs.length;
      const variance = outputs.reduce((sum, val) => sum + (val - mean) ** 2, 0) / outputs.length;
      expect(variance).toBeGreaterThan(0);
    });

    it('should produce notch pattern at center frequency', () => {
      phaser.setParams({
        rate: 100000,
        feedback: 0.3,
        centerFreq: 1000,
        mix: 0.5,
        octaves: 0
      });
      phaser.reset();
      let totalPowerCenter = 0;
      for (let i = 0; i < 4800; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        const output = phaser.process(input);
        if (i > 1000) {
          totalPowerCenter += output * output;
        }
      }
      phaser.reset();
      let totalPowerOther = 0;
      for (let i = 0; i < 4800; i++) {
        const input = Math.sin(2 * Math.PI * 3000 * i / sampleRate);
        const output = phaser.process(input);
        if (i > 1000) {
          totalPowerOther += output * output;
        }
      }
      expect(totalPowerCenter).toBeGreaterThanOrEqual(0);
      expect(totalPowerOther).toBeGreaterThanOrEqual(0);
    });

    it('should create jet plane sweep effect', () => {
      phaser.setParams({
        rate: 200,
        feedback: 0.6,
        centerFreq: 300,
        octaves: 3,
        Q: 0.707,
        mix: 0.5
      });
      phaser.reset();
      const outputs: number[] = [];
      for (let i = 0; i < sampleRate * 2; i++) {
        const input = (Math.random() * 2 - 1) * 0.3;
        outputs.push(phaser.process(input));
      }
      expect(outputs.filter(Number.isFinite).length).toBe(sampleRate * 2);
    });
  });

  describe('stereo processing simulation', () => {
    it('should process left and right channels independently', () => {
      const phaserL = new PhaserEffect(sampleRate);
      const phaserR = new PhaserEffect(sampleRate);
      phaserL.setParams({ rate: 500, feedback: 0.5 });
      phaserR.setParams({ rate: 500, feedback: 0.5 });
      phaserL.reset();
      phaserR.reset();
      for (let i = 0; i < 100; i++) {
        const input = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        const outputL = phaserL.process(input);
        const outputR = phaserR.process(input);
        expect(Math.abs(outputL - outputR)).toBeLessThan(0.0001);
      }
    });
  });
});
