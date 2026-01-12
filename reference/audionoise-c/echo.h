//
// Minimal echo effect
//
static inline void echo_init(float pot1, float pot2, float pot3, float pot4)
{
	effect_set_delay(pot1 * 1000);	// delay = 0 .. 1s
	effect_set_lfo_ms(pot3*4);	// LFO = 0 .. 4ms
	effect_set_feedback(pot4);	// feedback = 0 .. 100%

	fprintf(stderr, "echo:");
	fprintf(stderr, " delay=%g ms", pot1 * 1000);
	fprintf(stderr, " lfo=%g ms", pot3*4);
	fprintf(stderr, " feedback=%g\n", pot4);
}

static inline float echo_step(float in)
{
	float d = 1 + effect_delay;
	float out;

	out = sample_array_read(d);
	sample_array_write(limit_value(in + out * effect_feedback));

	return (in + out)/ 2;
}
