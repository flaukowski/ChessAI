//
// PRD-002: Electric Guitar Harmonic Enhancer
//
// Add musically useful harmonic density and articulation without traditional
// distortion artifacts or fizz.
//
// Target: Clean or edge-of-breakup electric guitar, amp-sim input or DI
//
// Architecture: Three parallel harmonic paths with frequency-specific nonlinear generation
//   Path A: Fundamental (HPF 80 Hz, no nonlinearity)
//   Path B: Even harmonics (full-wave rect, LPF 500-800 Hz)
//   Path C: Odd harmonics (hard clip, LPF 1.5-2.5 kHz)
//

struct {
	// Path A - Fundamental / Dry
	struct biquad fund_hpf;
	float fund_level;

	// Path B - Even harmonics (warmth)
	struct biquad even_lpf[2];  // 3rd order approximation
	float even_level;

	// Path C - Odd harmonics (edge)
	struct biquad odd_lpf;      // 2nd order
	float odd_level;

	// Output
	float output_level;
} guitar_harmonic;

void guitar_harmonic_init(float pot1, float pot2, float pot3, float pot4)
{
	// pot1: Dry/Fundamental level
	// pot2: Even harmonics (warmth)
	// pot3: Odd harmonics (edge)
	// pot4: Output level

	guitar_harmonic.fund_level = pot1;
	guitar_harmonic.even_level = pot2 * pot2;  // Log response
	guitar_harmonic.odd_level = pot3 * pot3;   // Log response
	guitar_harmonic.output_level = 0.5f + pot4 * 0.5f;

	// Path A: 1st-order HPF at 80 Hz
	biquad_hpf(&guitar_harmonic.fund_hpf, 80.0f, 0.707f);

	// Path B: 3rd-order LPF at 650 Hz (center of 500-800)
	// Two cascaded biquads for steeper rolloff
	biquad_lpf(&guitar_harmonic.even_lpf[0], 650.0f, 0.707f);
	biquad_lpf(&guitar_harmonic.even_lpf[1], 650.0f, 0.707f);

	// Path C: 2nd-order LPF at 2 kHz (center of 1.5-2.5)
	biquad_lpf(&guitar_harmonic.odd_lpf, 2000.0f, 0.707f);

	fprintf(stderr, "guitar_harmonic:");
	fprintf(stderr, " dry=%.2f", guitar_harmonic.fund_level);
	fprintf(stderr, " even=%.2f", guitar_harmonic.even_level);
	fprintf(stderr, " odd=%.2f", guitar_harmonic.odd_level);
	fprintf(stderr, " out=%.2f\n", guitar_harmonic.output_level);
}

float guitar_harmonic_step(float in)
{
	float path_a, path_b, path_c;

	// Path A: Fundamental - preserve transient snap and chord clarity
	path_a = biquad_step(&guitar_harmonic.fund_hpf, in);
	path_a *= guitar_harmonic.fund_level;

	// Path B: Even harmonics - body, bloom, tube-like warmth
	float even = fabsf(in);  // Full-wave rectification
	even = biquad_step(&guitar_harmonic.even_lpf[0], even);
	even = biquad_step(&guitar_harmonic.even_lpf[1], even);
	path_b = even * guitar_harmonic.even_level;

	// Path C: Odd harmonics - bite, pick articulation, harmonic sparkle
	float odd = in;
	// Hard clip - symmetrical
	if (odd > 0.4f) odd = 0.4f;
	if (odd < -0.4f) odd = -0.4f;
	odd = biquad_step(&guitar_harmonic.odd_lpf, odd);
	path_c = odd * guitar_harmonic.odd_level;

	// Sum all paths
	float out = (path_a + path_b + path_c) * guitar_harmonic.output_level;

	return limit_value(out);
}
