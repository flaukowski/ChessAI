//
// PRD-003: Vocal Harmonic Presence Engine
//
// Increase vocal intelligibility, density, and perceived intimacy without
// audible distortion or harsh sibilance.
//
// Target: Lead vocals, spoken word
//
// Architecture: Parallel harmonic enhancement with sibilance protection
//   Path A: Fundamental (HPF 100 Hz, optional LPF 10-12 kHz)
//   Path B: Even harmonics (abs, LPF 1-2 kHz, DC block) - chest/warmth
//   Path C: Odd harmonics (soft-to-hard sat, LPF 3-5 kHz, de-emphasis) - clarity
//

struct {
	// Path A - Fundamental
	struct biquad fund_hpf;
	struct biquad fund_lpf;     // Optional high-frequency limit
	float fund_level;

	// Path B - Even harmonics (body)
	struct biquad even_lpf[2];  // 3rd order approximation
	struct biquad even_dc;      // DC blocking
	float even_level;

	// Path C - Odd harmonics (presence)
	struct biquad odd_lpf;      // 2nd order LPF
	struct biquad odd_deemph;   // De-emphasis shelf above 6 kHz
	float odd_level;

	// Output
	float output_trim;
} vocal_harmonic;

// Soft-to-hard saturation curve (no foldback)
// Smooth transition from linear to clipped
static inline float vocal_saturate(float x)
{
	float ax = fabsf(x);
	if (ax < 0.3f) {
		// Linear region
		return x;
	} else if (ax < 0.7f) {
		// Soft knee region - smooth polynomial transition
		float t = (ax - 0.3f) / 0.4f;  // 0 to 1 in transition zone
		float gain = 1.0f - 0.3f * t * t;  // Gradual compression
		return x * gain;
	} else {
		// Hard clip region
		float sign = (x > 0) ? 1.0f : -1.0f;
		return sign * (0.7f + 0.1f * (1.0f - 1.0f / (1.0f + (ax - 0.7f))));
	}
}

void vocal_harmonic_init(float pot1, float pot2, float pot3, float pot4)
{
	// pot1: Fundamental level
	// pot2: Even harmonics (body)
	// pot3: Odd harmonics (presence)
	// pot4: Output trim

	vocal_harmonic.fund_level = pot1;
	vocal_harmonic.even_level = pot2 * pot2;
	vocal_harmonic.odd_level = pot3 * pot3;
	vocal_harmonic.output_trim = 0.5f + pot4 * 0.5f;

	// Path A: HPF at 100 Hz, LPF at 11 kHz (gentle top-end rolloff)
	biquad_hpf(&vocal_harmonic.fund_hpf, 100.0f, 0.707f);
	biquad_lpf(&vocal_harmonic.fund_lpf, 11000.0f, 0.707f);

	// Path B: 3rd-order LPF at 1.5 kHz (center of 1-2 kHz)
	biquad_lpf(&vocal_harmonic.even_lpf[0], 1500.0f, 0.54f);
	biquad_lpf(&vocal_harmonic.even_lpf[1], 1500.0f, 1.31f);
	// DC block at 10 Hz
	biquad_hpf(&vocal_harmonic.even_dc, 10.0f, 0.707f);

	// Path C: 2nd-order LPF at 4 kHz (center of 3-5 kHz)
	biquad_lpf(&vocal_harmonic.odd_lpf, 4000.0f, 0.707f);
	// De-emphasis: gentle LPF at 6 kHz to tame sibilance in harmonics
	biquad_lpf(&vocal_harmonic.odd_deemph, 6000.0f, 0.5f);

	fprintf(stderr, "vocal_harmonic:");
	fprintf(stderr, " fund=%.2f", vocal_harmonic.fund_level);
	fprintf(stderr, " even=%.2f", vocal_harmonic.even_level);
	fprintf(stderr, " odd=%.2f", vocal_harmonic.odd_level);
	fprintf(stderr, " trim=%.2f\n", vocal_harmonic.output_trim);
}

float vocal_harmonic_step(float in)
{
	float path_a, path_b, path_c;

	// Path A: Fundamental - maintain natural vocal tone
	path_a = biquad_step(&vocal_harmonic.fund_hpf, in);
	path_a = biquad_step(&vocal_harmonic.fund_lpf, path_a);
	path_a *= vocal_harmonic.fund_level;

	// Path B: Even harmonics - chest, warmth, proximity effect
	float even = fabsf(in);  // Absolute value nonlinearity
	even = biquad_step(&vocal_harmonic.even_lpf[0], even);
	even = biquad_step(&vocal_harmonic.even_lpf[1], even);
	even = biquad_step(&vocal_harmonic.even_dc, even);
	path_b = even * vocal_harmonic.even_level;

	// Path C: Odd harmonics - clarity and articulation without sibilance
	float odd = vocal_saturate(in);  // Soft-to-hard saturation
	odd = biquad_step(&vocal_harmonic.odd_lpf, odd);
	odd = biquad_step(&vocal_harmonic.odd_deemph, odd);  // De-emphasis
	path_c = odd * vocal_harmonic.odd_level;

	// Phase-coherent sum
	float out = (path_a + path_b + path_c) * vocal_harmonic.output_trim;

	return limit_value(out);
}
