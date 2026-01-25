import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConvolutionReverbEffect,
  createConvolutionReverbNode,
  ROOM_SIZE_MAP,
  ROOM_SIZE_REVERSE_MAP,
  type RoomSize,
  type ConvolutionReverbParams,
} from '../../lib/dsp/effects/convolution-reverb';
import {
  MockAudioContext,
  setupAudioContextMock,
  cleanupAudioContextMock,
} from '../mocks/audio-context.mock';

describe('ConvolutionReverbEffect', () => {
  let context: MockAudioContext;

  beforeEach(() => {
    setupAudioContextMock();
    context = new MockAudioContext();
  });

  afterEach(() => {
    cleanupAudioContextMock();
  });

  describe('ROOM_SIZE_MAP and ROOM_SIZE_REVERSE_MAP', () => {
    it('should have all room sizes in map', () => {
      expect(ROOM_SIZE_MAP[0]).toBe('small');
      expect(ROOM_SIZE_MAP[1]).toBe('medium');
      expect(ROOM_SIZE_MAP[2]).toBe('large');
      expect(ROOM_SIZE_MAP[3]).toBe('hall');
    });

    it('should have reverse map for all room sizes', () => {
      expect(ROOM_SIZE_REVERSE_MAP.small).toBe(0);
      expect(ROOM_SIZE_REVERSE_MAP.medium).toBe(1);
      expect(ROOM_SIZE_REVERSE_MAP.large).toBe(2);
      expect(ROOM_SIZE_REVERSE_MAP.hall).toBe(3);
    });

    it('should have matching forward and reverse maps', () => {
      for (const [key, value] of Object.entries(ROOM_SIZE_MAP)) {
        expect(ROOM_SIZE_REVERSE_MAP[value as RoomSize]).toBe(Number(key));
      }
    });
  });

  describe('createConvolutionReverbNode', () => {
    it('should create a reverb node with default parameters', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      expect(reverb).toBeDefined();
      expect(reverb.input).toBeDefined();
      expect(reverb.output).toBeDefined();
      expect(reverb.convolver).toBeDefined();
      expect(reverb.preDelayNode).toBeDefined();
    });

    it('should create nodes using audio context', () => {
      createConvolutionReverbNode(context as unknown as AudioContext);

      expect(context.createGain).toHaveBeenCalled();
      expect(context.createDelay).toHaveBeenCalled();
      expect(context.createConvolver).toHaveBeenCalled();
      expect(context.createBuffer).toHaveBeenCalled();
    });

    it('should create with custom parameters', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext, {
        wetDryMix: 0.5,
        decay: 3.0,
        preDelay: 50,
        roomSize: 'large',
        damping: 0.7,
      });

      expect(reverb).toBeDefined();
      expect(reverb.mix).toBe(0.5);
    });

    it('should allow setting wet/dry mix', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setWetDryMix(0.7);
      expect(reverb.mix).toBe(0.7);
    });

    it('should clamp wet/dry mix to valid range', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setWetDryMix(-0.5);
      expect(reverb.mix).toBe(0);

      reverb.setWetDryMix(1.5);
      expect(reverb.mix).toBe(1);
    });

    it('should allow setting pre-delay', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setPreDelay(50);
      // Should not throw
      expect(reverb).toBeDefined();
    });

    it('should clamp pre-delay to valid range', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      // Should not throw even with out-of-range values
      reverb.setPreDelay(-10);
      reverb.setPreDelay(200);
      expect(reverb).toBeDefined();
    });

    it('should allow setting decay', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setDecay(5.0);
      expect(reverb).toBeDefined();
    });

    it('should allow setting room size', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setRoomSize('hall');
      expect(reverb).toBeDefined();

      reverb.setRoomSize('small');
      expect(reverb).toBeDefined();
    });

    it('should allow setting damping', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      reverb.setDamping(0.8);
      expect(reverb).toBeDefined();
    });

    it('should allow setting bypass', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      expect(reverb.bypass).toBe(false);

      reverb.setBypass(true);
      expect(reverb.bypass).toBe(true);

      reverb.setBypass(false);
      expect(reverb.bypass).toBe(false);
    });

    it('should allow updating impulse response', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      // Should not throw
      reverb.updateImpulseResponse();
      expect(reverb).toBeDefined();
    });

    it('should clean up on destroy', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      // Should not throw
      reverb.destroy();
      expect(reverb).toBeDefined();
    });
  });

  describe('ConvolutionReverbEffect class', () => {
    it('should create effect with default parameters', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      expect(effect).toBeDefined();
      expect(effect.input).toBeDefined();
      expect(effect.output).toBeDefined();
    });

    it('should have default parameter values', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);
      const params = effect.params;

      expect(params.wetDryMix).toBe(0.3);
      expect(params.decay).toBe(1.5);
      expect(params.preDelay).toBe(10);
      expect(params.roomSize).toBe('medium');
      expect(params.damping).toBe(0.5);
    });

    it('should allow setting individual parameters', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      effect.setWetDryMix(0.6);
      expect(effect.params.wetDryMix).toBe(0.6);
      expect(effect.mix).toBe(0.6);

      effect.setDecay(3.0);
      expect(effect.params.decay).toBe(3.0);

      effect.setPreDelay(40);
      expect(effect.params.preDelay).toBe(40);

      effect.setRoomSize('hall');
      expect(effect.params.roomSize).toBe('hall');

      effect.setDamping(0.7);
      expect(effect.params.damping).toBe(0.7);
    });

    it('should allow setting all parameters at once', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      effect.setAllParams({
        wetDryMix: 0.5,
        decay: 2.5,
        preDelay: 30,
        roomSize: 'large',
        damping: 0.6,
      });

      expect(effect.params.wetDryMix).toBe(0.5);
      expect(effect.params.decay).toBe(2.5);
      expect(effect.params.preDelay).toBe(30);
      expect(effect.params.roomSize).toBe('large');
      expect(effect.params.damping).toBe(0.6);
    });

    it('should support mix parameter alias', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      effect.setAllParams({ mix: 0.8 });
      expect(effect.mix).toBe(0.8);
      expect(effect.params.wetDryMix).toBe(0.8);
    });

    it('should handle bypass', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      expect(effect.bypass).toBe(false);

      effect.setBypass(true);
      expect(effect.bypass).toBe(true);

      effect.setBypass(false);
      expect(effect.bypass).toBe(false);
    });

    it('should clamp parameter values to valid ranges', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      effect.setWetDryMix(-1);
      expect(effect.params.wetDryMix).toBe(0);

      effect.setWetDryMix(2);
      expect(effect.params.wetDryMix).toBe(1);

      effect.setDecay(0.01);
      expect(effect.params.decay).toBe(0.1);

      effect.setDecay(100);
      expect(effect.params.decay).toBe(10);

      effect.setPreDelay(-10);
      expect(effect.params.preDelay).toBe(0);

      effect.setPreDelay(200);
      expect(effect.params.preDelay).toBe(100);

      effect.setDamping(-0.5);
      expect(effect.params.damping).toBe(0);

      effect.setDamping(1.5);
      expect(effect.params.damping).toBe(1);
    });

    it('should ignore invalid room size', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      const originalRoomSize = effect.params.roomSize;
      // @ts-ignore - Testing invalid input
      effect.setRoomSize('invalid');
      expect(effect.params.roomSize).toBe(originalRoomSize);
    });

    it('should clean up on destroy', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);

      // Should not throw
      effect.destroy();
      expect(effect).toBeDefined();
    });

    it('should return a copy of params', () => {
      const effect = new ConvolutionReverbEffect(context as unknown as AudioContext);
      const params1 = effect.params;
      const params2 = effect.params;

      // Modify the returned object
      params1.wetDryMix = 0.99;

      // Original should be unchanged
      expect(params2.wetDryMix).toBe(0.3);
      expect(effect.params.wetDryMix).toBe(0.3);
    });
  });

  describe('impulse response generation', () => {
    it('should generate buffer with stereo channels', () => {
      createConvolutionReverbNode(context as unknown as AudioContext);

      // Verify createBuffer was called with 2 channels
      expect(context.createBuffer).toHaveBeenCalledWith(
        2,
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should generate different IR for different room sizes', () => {
      const createBufferSpy = vi.spyOn(context, 'createBuffer');

      // Create reverb with small room
      createConvolutionReverbNode(context as unknown as AudioContext, {
        roomSize: 'small',
        decay: 1.0,
      });

      const smallRoomLength = createBufferSpy.mock.calls[0][1];

      // Reset and create reverb with hall
      createBufferSpy.mockClear();
      createConvolutionReverbNode(context as unknown as AudioContext, {
        roomSize: 'hall',
        decay: 1.0,
      });

      const hallLength = createBufferSpy.mock.calls[0][1];

      // Hall should have a longer IR due to baseDecay multiplier
      expect(hallLength).toBeGreaterThan(smallRoomLength);
    });

    it('should generate longer IR for longer decay', () => {
      const createBufferSpy = vi.spyOn(context, 'createBuffer');

      // Create reverb with short decay
      createConvolutionReverbNode(context as unknown as AudioContext, {
        decay: 0.5,
      });

      const shortDecayLength = createBufferSpy.mock.calls[0][1];

      // Reset and create reverb with long decay
      createBufferSpy.mockClear();
      createConvolutionReverbNode(context as unknown as AudioContext, {
        decay: 5.0,
      });

      const longDecayLength = createBufferSpy.mock.calls[0][1];

      // Longer decay should result in longer IR
      expect(longDecayLength).toBeGreaterThan(shortDecayLength);
    });

    it('should regenerate IR when decay changes', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      const initialCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;

      reverb.setDecay(3.0);

      const newCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    });

    it('should regenerate IR when room size changes', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      const initialCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;

      reverb.setRoomSize('hall');

      const newCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    });

    it('should regenerate IR when damping changes', () => {
      const reverb = createConvolutionReverbNode(context as unknown as AudioContext);

      const initialCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;

      reverb.setDamping(0.9);

      const newCallCount = (context.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('room presets', () => {
    it('should support all room sizes', () => {
      const roomSizes: RoomSize[] = ['small', 'medium', 'large', 'hall'];

      for (const size of roomSizes) {
        const reverb = createConvolutionReverbNode(context as unknown as AudioContext, {
          roomSize: size,
        });
        expect(reverb).toBeDefined();
      }
    });
  });
});
