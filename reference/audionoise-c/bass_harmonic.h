//
// PRD-001: Bass Harmonic Sculptor
//
// Enhance bass instruments by synthesizing controlled 2nd and 3rd harmonics
// to improve audibility on small speakers while preserving low-frequency
// authority and pitch stability.
//
// Target: Electric bass (DI, amp sim), Synth bass (mono preferred)
//
// Architecture: Parallel 3-path harmonic synthesis with phase-coherent summing
//   Path A: Fundamental (no nonlinearity, HPF 60-80 Hz)
//   Path B: Even harmonics (full-wave rect, LPF 180-250 Hz, DC block)
//   Path C: Odd harmonics (hard clip, LPF 300-450 Hz)
//

struct {
	// Path A - Fundamental
	struct biquad fund_hpf;
	float fund_level;

	// Path B - Even harmonics (2nd dominant)
	struct biquad even_lpf[2];  // 4th order = 2 cascaded biquads
	struct biquad even_dc;      // DC blocking HPF
	float even_level;

	// Path C - Odd harmonics (3rd dominant)
	struct biquad odd_lpf[2];   // Approximate 3rd order with 2 biquads
	float odd_level;

	// Output
	float output_trim;
} bass_harmonic;

void bass_harmonic_init(float pot1, float pot2, float pot3, float pot4)
{
	// pot1: Fundamental level (linear 0-1)
	// pot2: Even harmonics level (log curve)
	// pot3: Odd harmonics level (log curve)
	// pot4: Output trim

	bass_harmonic.fund_level = pot1;
	// Log curve for harmonic levels: more sensitivity at low end
	bass_harmonic.even_level = pot2 * pot2;
	bass_harmonic.odd_level = pot3 * pot3;
	bass_harmonic.output_trim = 0.5f + pot4 * 0.5f;  // 0.5 to 1.0

	// Path A: 1st-order HPF at 70 Hz (center of 60-80 range)
	// Using Q=0.707 for Butterworth-like response
	biquad_hpf(&bass_harmonic.fund_hpf, 70.0f, 0.707f);

	// Path B: 4th-order LPF at 215 Hz (center of 180-250)
	// Two cascaded 2nd-order sections
	biquad_lpf(&bass_harmonic.even_lpf[0], 215.0f, 0.707f);
	biquad_lpf(&bass_harmonic.even_lpf[1], 215.0f, 0.707f);
	// DC blocking HPF at 7.5 Hz (center of 5-10)
	biquad_hpf(&bass_harmonic.even_dc, 7.5f, 0.707f);

	// Path C: ~3rd-order LPF at 375 Hz (center of 300-450)
	// Two biquads with slightly different Q for steeper rolloff
	biquad_lpf(&bass_harmonic.odd_lpf[0], 375.0f, 0.54f);
	biquad_lpf(&bass_harmonic.odd_lpf[1], 375.0f, 1.31f);

	fprintf(stderr, "bass_harmonic:");
	fprintf(stderr, " fund=%.2f", bass_harmonic.fund_level);
	fprintf(stderr, " even=%.2f", bass_harmonic.even_level);
	fprintf(stderr, " odd=%.2f", bass_harmonic.odd_level);
	fprintf(stderr, " trim=%.2f\n", bass_harmonic.output_trim);
}

float bass_harmonic_step(float in)
{
	float path_a, path_b, path_c;

	// Path A: Fundamental - HPF only, no nonlinearity
	path_a = biquad_step(&bass_harmonic.fund_hpf, in);
	path_a *= bass_harmonic.fund_level;

	// Path B: Even harmonics - full-wave rectification
	float even = fabsf(in);  // Full-wave rectification generates 2nd harmonic
	even = biquad_step(&bass_harmonic.even_lpf[0], even);
	even = biquad_step(&bass_harmonic.even_lpf[1], even);
	even = biquad_step(&bass_harmonic.even_dc, even);  // DC block
	path_b = even * bass_harmonic.even_level;

	// Path C: Odd harmonics - hard symmetrical clipping
	float odd = in;
	// Hard clip at +/- 0.5 to generate 3rd harmonic content
	if (odd > 0.5f) odd = 0.5f;
	if (odd < -0.5f) odd = -0.5f;
	odd = biquad_step(&bass_harmonic.odd_lpf[0], odd);
	odd = biquad_step(&bass_harmonic.odd_lpf[1], odd);
	path_c = odd * bass_harmonic.odd_level;

	// Phase-coherent sum
	float out = (path_a + path_b + path_c) * bass_harmonic.output_trim;

	return limit_value(out);
}
