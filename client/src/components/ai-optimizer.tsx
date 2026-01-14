/**
 * AI Optimizer Component
 * When enabled, automatically optimizes effect parameters based on audio analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Brain, Zap, Settings2, 
  Loader2, Check, AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EffectType, EffectInstance } from '@/hooks/use-audio-dsp';
import { cn } from '@/lib/utils';

interface AIOptimizerProps {
  effects: EffectInstance[];
  analyser: AnalyserNode | null;
  currentGenre?: string;
  onOptimize: (effectId: string, params: Record<string, number>) => void;
  className?: string;
}

interface OptimizationResult {
  effectId: string;
  effectType: EffectType;
  originalParams: Record<string, number>;
  optimizedParams: Record<string, number>;
  confidence: number;
  reason: string;
}

// AI optimization presets based on genre and effect type
const OPTIMIZATION_RULES: Record<string, Record<EffectType, (profile: FrequencyProfile) => Record<string, number>>> = {
  'indie-pop': {
    echo: (p) => ({ 
      delayMs: p.tempo > 0.5 ? 200 : 350, 
      feedback: 0.35 - p.highEnergy * 0.1, 
      mix: 0.4 
    }),
    flanger: (p) => ({ 
      rate: 0.3 + p.midEnergy * 0.3, 
      depth: 0.5, 
      feedback: 0.4, 
      mix: 0.35 
    }),
    phaser: (p) => ({ 
      rate: 0.25, 
      depth: 600 + p.midEnergy * 400, 
      feedback: 0.45, 
      mix: 0.4 
    }),
    lowpass: (p) => ({ 
      frequency: 4000 + (1 - p.highEnergy) * 4000, 
      Q: 0.5 + p.bassEnergy * 0.5 
    }),
    highpass: (p) => ({ 
      frequency: 60 + p.bassEnergy * 60, 
      Q: 0.707 
    }),
    bandpass: (p) => ({ 
      frequency: 1000 + p.midEnergy * 1500, 
      Q: 1 
    }),
    notch: (p) => ({ 
      frequency: 400 + p.overall * 200, 
      Q: 2 
    }),
  },
  'electronic': {
    echo: (p) => ({ 
      delayMs: 125 + p.tempo * 125, 
      feedback: 0.5, 
      mix: 0.45 
    }),
    flanger: (p) => ({ 
      rate: 0.5 + p.highEnergy * 1.5, 
      depth: 0.7, 
      feedback: 0.6, 
      mix: 0.5 
    }),
    phaser: (p) => ({ 
      rate: 0.4 + p.tempo * 0.4, 
      depth: 1000, 
      feedback: 0.5, 
      mix: 0.45 
    }),
    lowpass: (p) => ({ 
      frequency: 2000 + p.highEnergy * 6000, 
      Q: 1 + p.bassEnergy 
    }),
    highpass: (p) => ({ 
      frequency: 80, 
      Q: 0.707 
    }),
    bandpass: (p) => ({ 
      frequency: 800 + p.midEnergy * 2000, 
      Q: 1.5 
    }),
    notch: (p) => ({ 
      frequency: 300, 
      Q: 3 
    }),
  },
  'ambient': {
    echo: (p) => ({ 
      delayMs: 500 + (1 - p.tempo) * 300, 
      feedback: 0.6, 
      mix: 0.55 
    }),
    flanger: (p) => ({ 
      rate: 0.1 + p.overall * 0.15, 
      depth: 0.6, 
      feedback: 0.3, 
      mix: 0.4 
    }),
    phaser: (p) => ({ 
      rate: 0.15, 
      depth: 1200, 
      feedback: 0.35, 
      mix: 0.45 
    }),
    lowpass: (p) => ({ 
      frequency: 3000 + (1 - p.highEnergy) * 2000, 
      Q: 0.3 
    }),
    highpass: (p) => ({ 
      frequency: 40, 
      Q: 0.5 
    }),
    bandpass: (p) => ({ 
      frequency: 500 + p.midEnergy * 500, 
      Q: 0.5 
    }),
    notch: (p) => ({ 
      frequency: 250, 
      Q: 1 
    }),
  },
};

interface FrequencyProfile {
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  overall: number;
  tempo: number;
}

function analyzeFrequencyProfile(frequencyData: Uint8Array): FrequencyProfile {
  if (frequencyData.length === 0) {
    return { bassEnergy: 0.5, midEnergy: 0.5, highEnergy: 0.5, overall: 0.5, tempo: 0.5 };
  }

  const bassEnd = Math.floor(frequencyData.length * 0.1);
  const midEnd = Math.floor(frequencyData.length * 0.5);

  let bassSum = 0, midSum = 0, highSum = 0;

  for (let i = 0; i < bassEnd; i++) bassSum += frequencyData[i];
  for (let i = bassEnd; i < midEnd; i++) midSum += frequencyData[i];
  for (let i = midEnd; i < frequencyData.length; i++) highSum += frequencyData[i];

  const bassEnergy = bassSum / (bassEnd * 255);
  const midEnergy = midSum / ((midEnd - bassEnd) * 255);
  const highEnergy = highSum / ((frequencyData.length - midEnd) * 255);
  const overall = (bassEnergy + midEnergy + highEnergy) / 3;

  // Estimate tempo from transient energy (simplified)
  const tempo = Math.min(1, overall * 1.5);

  return { bassEnergy, midEnergy, highEnergy, overall, tempo };
}

export function AIOptimizer({ 
  effects, 
  analyser, 
  currentGenre = 'indie-pop',
  onOptimize,
  className 
}: AIOptimizerProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<OptimizationResult[]>([]);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const runOptimization = useCallback(async () => {
    if (!analyser || effects.length === 0) return;
    
    setIsOptimizing(true);

    // Get frequency data
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    const profile = analyzeFrequencyProfile(frequencyData);

    // Get genre-specific rules or fall back to indie-pop
    const rules = OPTIMIZATION_RULES[currentGenre] || OPTIMIZATION_RULES['indie-pop'];

    const results: OptimizationResult[] = [];

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 600));

    for (const effect of effects) {
      if (!effect.enabled) continue;

      const optimizeFn = rules[effect.type];
      if (!optimizeFn) continue;

      const optimizedParams = optimizeFn(profile);
      
      // Calculate confidence based on how different the audio profile is
      const variance = Math.abs(profile.bassEnergy - profile.highEnergy);
      const confidence = 0.7 + variance * 0.25 + profile.overall * 0.1;

      results.push({
        effectId: effect.id,
        effectType: effect.type,
        originalParams: { ...effect.params },
        optimizedParams,
        confidence: Math.min(0.98, confidence),
        reason: generateReason(effect.type, profile),
      });

      // Apply optimization
      onOptimize(effect.id, optimizedParams);
    }

    setLastOptimization(results);
    setIsOptimizing(false);
  }, [analyser, effects, currentGenre, onOptimize]);

  // Auto-optimization interval
  useEffect(() => {
    if (isEnabled && autoOptimize) {
      intervalRef.current = setInterval(runOptimization, 3000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isEnabled, autoOptimize, runOptimization]);

  const handleToggle = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      runOptimization();
    }
  }, [runOptimization]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Gradient header */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500" />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            AI Optimizer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="ai-optimizer"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              className="scale-75"
            />
            <Label htmlFor="ai-optimizer" className="text-xs text-muted-foreground">
              {isEnabled ? 'On' : 'Off'}
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <AnimatePresence mode="wait">
          {!isEnabled ? (
            <motion.div
              key="disabled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-4 text-muted-foreground"
            >
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Enable AI to auto-optimize effect settings</p>
            </motion.div>
          ) : (
            <motion.div
              key="enabled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Controls */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-optimize"
                    checked={autoOptimize}
                    onCheckedChange={setAutoOptimize}
                    className="scale-75"
                  />
                  <Label htmlFor="auto-optimize" className="text-xs">
                    Auto-tune
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runOptimization}
                  disabled={isOptimizing || effects.length === 0}
                  className="h-7 text-xs"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 mr-1" />
                      Optimize Now
                    </>
                  )}
                </Button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 text-xs">
                <Settings2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Genre:</span>
                <Badge variant="secondary" className="text-[10px] py-0">
                  {currentGenre}
                </Badge>
                {autoOptimize && (
                  <Badge variant="outline" className="text-[10px] py-0 text-green-500 border-green-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
              </div>

              {/* Optimization results */}
              {lastOptimization.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Last Optimization
                  </p>
                  {lastOptimization.slice(0, 3).map((result) => (
                    <div
                      key={result.effectId}
                      className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="capitalize font-medium">{result.effectType}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] py-0",
                          result.confidence > 0.85 
                            ? "text-green-500 border-green-500/30" 
                            : "text-yellow-500 border-yellow-500/30"
                        )}
                      >
                        {Math.round(result.confidence * 100)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {effects.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-yellow-500 p-2 rounded bg-yellow-500/10">
                  <AlertCircle className="w-3 h-3" />
                  <span>Add effects to enable optimization</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function generateReason(effectType: EffectType, profile: FrequencyProfile): string {
  const reasons: Record<EffectType, string[]> = {
    echo: [
      `Adjusted delay for ${profile.tempo > 0.5 ? 'faster' : 'slower'} tempo`,
      `Feedback balanced for ${profile.highEnergy > 0.5 ? 'bright' : 'warm'} audio`,
    ],
    flanger: [
      `Rate optimized for ${profile.midEnergy > 0.5 ? 'dense' : 'sparse'} mids`,
      `Depth set for maximum movement`,
    ],
    phaser: [
      `Sweep depth tuned to frequency content`,
      `Rate adjusted for smooth modulation`,
    ],
    lowpass: [
      `Cutoff set to preserve ${profile.highEnergy > 0.5 ? 'brightness' : 'warmth'}`,
      `Q balanced for natural rolloff`,
    ],
    highpass: [
      `Cleaning up ${profile.bassEnergy > 0.6 ? 'heavy' : 'moderate'} bass`,
      `Gentle slope to preserve body`,
    ],
    bandpass: [
      `Centered on ${profile.midEnergy > 0.5 ? 'prominent' : 'subtle'} mid frequencies`,
      `Width set for natural resonance`,
    ],
    notch: [
      `Targeting problematic frequency`,
      `Narrow cut to preserve tone`,
    ],
  };

  const effectReasons = reasons[effectType];
  return effectReasons[Math.floor(Math.random() * effectReasons.length)];
}
