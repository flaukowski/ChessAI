//
// Silly frequency modulation signal generator "effect"
// It doesn't actually care about the input, it's useful
// mainly for testing the LFO
//
static struct lfo_state base_lfo, modulator_lfo;
static float fm_volume, fm_base_freq, fm_freq_range;

static inline void fm_init(float pot1, float pot2, float pot3, float pot4)
{
	fm_volume = pot1;
	fm_base_freq = fastpow(8000, pot2)+100;
	fm_freq_range = pot3;				//  max range one octave down and up
	set_lfo_freq(&modulator_lfo, 1 + 10*pot4);	// 1..11 Hz

	fprintf(stderr, "fm:");
	fprintf(stderr, " volume=%g", pot1);
	fprintf(stderr, " base=%g Hz", fm_base_freq);
	fprintf(stderr, " range=%.0f-%.0f Hz",
			fm_base_freq * (fastpow2_m1(-fm_freq_range)+1),
			fm_base_freq * (fastpow2_m1(fm_freq_range)+1));
	fprintf(stderr, " lfo=%g Hz\n", 1 + 10*pot4);
}

static inline float fm_step(float in)
{
	float lfo = lfo_step(&modulator_lfo, lfo_sinewave);
	float multiplier = fastpow2_m1(lfo * fm_freq_range) + 1;
	float freq = fm_base_freq * multiplier;
	set_lfo_freq(&base_lfo, freq);
	return lfo_step(&base_lfo, lfo_sinewave) * fm_volume;
}
