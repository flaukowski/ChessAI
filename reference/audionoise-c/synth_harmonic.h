//
// PRD-004: Poly Synth Harmonic Expander
//
// Add harmonic complexity and perceived analog richness to polyphonic
// synthesizers without collapsing stereo width or modulation detail.
//
// Target: Poly synths, pads, keys, evolving textures
//
// Architecture: Stereo-safe harmonic synthesis with gentle nonlinearities
//   Path A: Fundamental (HPF 40-60 Hz, no nonlinearity)
//   Path B: Even harmonics (full-wave rect, LPF 800-1.2 kHz, DC block)
//   Path C: Odd harmonics (mild hard clip/soft sat, LPF 2-4 kHz)
//
// Note: This is a mono implementation for the current AudioNoise framework.
// Stereo safety is achieved through deterministic, signal-dependent processing
// that maintains L/R correlation when applied identically to both channels.
//

struct {
	// Path A - Fundamental
	struct biquad fund_hpf;
	float fund_level;

	// Path B - Even harmonics (thickness, analog warmth)
	struct biquad even_lpf[2];  // 3rd order approximation
	struct biquad even_dc;      // DC blocking at 5 Hz
	float even_level;

	// Path C - Odd harmonics (harmonic movement, presence)
	struct biquad odd_lpf;      // 2nd order
	float odd_level;

	// Output
	float output_level;
} synth_harmonic;

// Mild soft saturation for synth - gentler than vocal to preserve modulation
static inline float synth_saturate(float x)
{
	// Soft polynomial saturation - very gentle, no hard clipping
	// Preserves modulation detail while adding subtle harmonics
	float x2 = x * x;
	float x3 = x2 * x;
	// Soft curve: x - 0.15*x^3 for gentle 3rd harmonic
	return x - 0.15f * x3;
}

void synth_harmonic_init(float pot1, float pot2, float pot3, float pot4)
{
	// pot1: Fundamental level
	// pot2: Even harmonics
	// pot3: Odd harmonics
	// pot4: Stereo-linked output level

	synth_harmonic.fund_level = pot1;
	synth_harmonic.even_level = pot2 * pot2;
	synth_harmonic.odd_level = pot3 * pot3;
	synth_harmonic.output_level = 0.5f + pot4 * 0.5f;

	// Path A: HPF at 50 Hz (center of 40-60)
	biquad_hpf(&synth_harmonic.fund_hpf, 50.0f, 0.707f);

	// Path B: 3rd-order LPF at 1 kHz (center of 800-1.2k)
	biquad_lpf(&synth_harmonic.even_lpf[0], 1000.0f, 0.54f);
	biquad_lpf(&synth_harmonic.even_lpf[1], 1000.0f, 1.31f);
	// DC block at 5 Hz
	biquad_hpf(&synth_harmonic.even_dc, 5.0f, 0.707f);

	// Path C: 2nd-order LPF at 3 kHz (center of 2-4 kHz)
	biquad_lpf(&synth_harmonic.odd_lpf, 3000.0f, 0.707f);

	fprintf(stderr, "synth_harmonic:");
	fprintf(stderr, " fund=%.2f", synth_harmonic.fund_level);
	fprintf(stderr, " even=%.2f", synth_harmonic.even_level);
	fprintf(stderr, " odd=%.2f", synth_harmonic.odd_level);
	fprintf(stderr, " out=%.2f\n", synth_harmonic.output_level);
}

float synth_harmonic_step(float in)
{
	float path_a, path_b, path_c;

	// Path A: Fundamental - preserve modulation and stereo image
	path_a = biquad_step(&synth_harmonic.fund_hpf, in);
	path_a *= synth_harmonic.fund_level;

	// Path B: Even harmonics - thickness, analog warmth
	float even = fabsf(in);  // Full-wave rectification
	even = biquad_step(&synth_harmonic.even_lpf[0], even);
	even = biquad_step(&synth_harmonic.even_lpf[1], even);
	even = biquad_step(&synth_harmonic.even_dc, even);
	path_b = even * synth_harmonic.even_level;

	// Path C: Odd harmonics - harmonic movement, presence
	// Using mild soft saturation to preserve modulation detail
	float odd = synth_saturate(in);
	odd = biquad_step(&synth_harmonic.odd_lpf, odd);
	path_c = odd * synth_harmonic.odd_level;

	// Deterministic sum - maintains stereo correlation
	float out = (path_a + path_b + path_c) * synth_harmonic.output_level;

	return limit_value(out);
}
