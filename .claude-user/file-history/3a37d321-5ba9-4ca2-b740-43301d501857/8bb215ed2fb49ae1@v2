import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Wand2, Loader2, ChevronRight, Lightbulb, Play, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Support both old and new effect types
export type EffectType = 'echo' | 'flanger' | 'phaser' | 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'eq' | 'distortion' | 'delay' | 'chorus' | 'compressor';

interface EffectSuggestion {
  type: EffectType;
  reason: string;
  params: Record<string, number>;
  confidence: number;
}

interface AIEffectSuggesterProps {
  analyser: AnalyserNode | null;
  onApplySuggestion: (type: EffectType, params: Record<string, number>) => void;
  onApplyChain?: (suggestions: EffectSuggestion[]) => void;
  currentGenre?: string;
  className?: string;
}

const GENRE_EFFECT_PRESETS: Record<string, EffectSuggestion[]> = {
  "indie-pop": [
    { type: "phaser", reason: "Adds dreamy, swirling texture", params: { rate: 0.3, depth: 600, feedback: 0.4, mix: 0.4 }, confidence: 0.85 },
    { type: "echo", reason: "Creates spacious atmosphere", params: { delayMs: 250, feedback: 0.3, mix: 0.35 }, confidence: 0.8 },
  ],
  "lo-fi": [
    { type: "lowpass", reason: "Vintage warmth and character", params: { frequency: 3000, Q: 0.5 }, confidence: 0.9 },
    { type: "echo", reason: "Classic lo-fi tape delay feel", params: { delayMs: 400, feedback: 0.4, mix: 0.3 }, confidence: 0.85 },
  ],
  "electronic": [
    { type: "flanger", reason: "Adds movement and modulation", params: { rate: 0.8, depth: 0.6, feedback: 0.5, mix: 0.5 }, confidence: 0.88 },
    { type: "highpass", reason: "Cleans up muddy low end", params: { frequency: 80, Q: 0.707 }, confidence: 0.82 },
  ],
  "rock": [
    { type: "echo", reason: "Adds depth to guitars", params: { delayMs: 180, feedback: 0.25, mix: 0.3 }, confidence: 0.85 },
    { type: "phaser", reason: "Classic rock phase sweep", params: { rate: 0.5, depth: 800, feedback: 0.5, mix: 0.45 }, confidence: 0.78 },
  ],
  "jazz": [
    { type: "echo", reason: "Subtle room ambience", params: { delayMs: 120, feedback: 0.2, mix: 0.25 }, confidence: 0.82 },
    { type: "lowpass", reason: "Warm tone shaping", params: { frequency: 8000, Q: 0.5 }, confidence: 0.75 },
  ],
  "ambient": [
    { type: "echo", reason: "Expansive reverberant space", params: { delayMs: 600, feedback: 0.6, mix: 0.5 }, confidence: 0.92 },
    { type: "phaser", reason: "Evolving ethereal textures", params: { rate: 0.15, depth: 1200, feedback: 0.3, mix: 0.4 }, confidence: 0.88 },
    { type: "lowpass", reason: "Soft, diffused character", params: { frequency: 4000, Q: 0.3 }, confidence: 0.8 },
  ],
  "trap": [
    { type: "highpass", reason: "Clean sub separation", params: { frequency: 60, Q: 1 }, confidence: 0.9 },
    { type: "echo", reason: "Trap delay throws", params: { delayMs: 350, feedback: 0.35, mix: 0.4 }, confidence: 0.85 },
  ],
  "house": [
    { type: "flanger", reason: "Classic house sweep", params: { rate: 0.4, depth: 0.7, feedback: 0.4, mix: 0.45 }, confidence: 0.87 },
    { type: "highpass", reason: "DJ filter effect", params: { frequency: 200, Q: 0.707 }, confidence: 0.83 },
  ],
};

function analyzeFrequencyProfile(frequencyData: Uint8Array): {
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  overall: number;
} {
  if (frequencyData.length === 0) {
    return { bassEnergy: 0, midEnergy: 0, highEnergy: 0, overall: 0 };
  }

  const bassEnd = Math.floor(frequencyData.length * 0.1);
  const midEnd = Math.floor(frequencyData.length * 0.5);

  let bassSum = 0, midSum = 0, highSum = 0;

  for (let i = 0; i < bassEnd; i++) {
    bassSum += frequencyData[i];
  }
  for (let i = bassEnd; i < midEnd; i++) {
    midSum += frequencyData[i];
  }
  for (let i = midEnd; i < frequencyData.length; i++) {
    highSum += frequencyData[i];
  }

  const bassEnergy = bassSum / (bassEnd * 255);
  const midEnergy = midSum / ((midEnd - bassEnd) * 255);
  const highEnergy = highSum / ((frequencyData.length - midEnd) * 255);
  const overall = (bassEnergy + midEnergy + highEnergy) / 3;

  return { bassEnergy, midEnergy, highEnergy, overall };
}

function generateDynamicSuggestions(profile: ReturnType<typeof analyzeFrequencyProfile>): EffectSuggestion[] {
  const suggestions: EffectSuggestion[] = [];

  // High bass energy - suggest highpass to clean up
  if (profile.bassEnergy > 0.6) {
    suggestions.push({
      type: "highpass",
      reason: "Detected heavy bass - clean up low frequencies",
      params: { frequency: 80, Q: 0.707 },
      confidence: 0.75 + profile.bassEnergy * 0.2,
    });
  }

  // Low high frequency energy - suggest presence boost or avoid lowpass
  if (profile.highEnergy < 0.3 && profile.midEnergy > 0.4) {
    suggestions.push({
      type: "bandpass",
      reason: "Add presence and clarity to mids",
      params: { frequency: 2500, Q: 0.5 },
      confidence: 0.7,
    });
  }

  // Balanced profile - suggest creative effects
  if (Math.abs(profile.bassEnergy - profile.highEnergy) < 0.2) {
    suggestions.push({
      type: "flanger",
      reason: "Balanced audio - add creative modulation",
      params: { rate: 0.5, depth: 0.5, feedback: 0.4, mix: 0.4 },
      confidence: 0.72,
    });
  }

  // Low overall energy - suggest compression/boost
  if (profile.overall < 0.3) {
    suggestions.push({
      type: "echo",
      reason: "Add depth and fullness to sparse audio",
      params: { delayMs: 200, feedback: 0.4, mix: 0.4 },
      confidence: 0.68,
    });
  }

  return suggestions;
}

// Advanced presets using new worklet effects
const ADVANCED_PRESETS: Record<string, EffectSuggestion[]> = {
  "guitar-clean": [
    { type: "eq", reason: "Shape clean tone with presence boost", params: { lowGain: -2, lowFreq: 200, midGain: 2, midFreq: 1000, midQ: 1, highGain: 4, highFreq: 5000, mix: 1 }, confidence: 0.88 },
    { type: "compressor", reason: "Even dynamics for clean playing", params: { threshold: -20, ratio: 3, attack: 10, release: 100, makeupGain: 3, mix: 1 }, confidence: 0.85 },
    { type: "chorus", reason: "Add shimmer and width", params: { rate: 0.5, depth: 0.4, voices: 2, mix: 0.25 }, confidence: 0.8 },
  ],
  "guitar-crunch": [
    { type: "eq", reason: "Pre-distortion tone shaping", params: { lowGain: 2, lowFreq: 200, midGain: 4, midFreq: 800, midQ: 1.5, highGain: -2, highFreq: 4000, mix: 1 }, confidence: 0.9 },
    { type: "distortion", reason: "Classic rock crunch", params: { drive: 0.4, tone: 0.6, mode: 0, level: 0.7, mix: 1 }, confidence: 0.92 },
    { type: "compressor", reason: "Tighten up the crunch", params: { threshold: -15, ratio: 4, attack: 5, release: 80, makeupGain: 4, mix: 0.7 }, confidence: 0.85 },
  ],
  "guitar-heavy": [
    { type: "eq", reason: "Scoop mids for heavy tone", params: { lowGain: 4, lowFreq: 150, midGain: -4, midFreq: 500, midQ: 2, highGain: 6, highFreq: 3000, mix: 1 }, confidence: 0.88 },
    { type: "distortion", reason: "High gain metal distortion", params: { drive: 0.8, tone: 0.5, mode: 1, level: 0.6, mix: 1 }, confidence: 0.95 },
    { type: "compressor", reason: "Maximum sustain and punch", params: { threshold: -10, ratio: 6, attack: 2, release: 50, makeupGain: 6, mix: 1 }, confidence: 0.9 },
  ],
  "vocal": [
    { type: "eq", reason: "Vocal presence and clarity", params: { lowGain: -6, lowFreq: 120, midGain: 3, midFreq: 2500, midQ: 1.5, highGain: 4, highFreq: 8000, mix: 1 }, confidence: 0.92 },
    { type: "compressor", reason: "Consistent vocal level", params: { threshold: -18, ratio: 4, attack: 15, release: 150, makeupGain: 4, mix: 1 }, confidence: 0.9 },
    { type: "delay", reason: "Subtle depth", params: { time: 150, feedback: 0.2, damping: 0.4, mix: 0.15 }, confidence: 0.75 },
  ],
  "bass": [
    { type: "eq", reason: "Bass tone sculpting", params: { lowGain: 3, lowFreq: 80, midGain: -2, midFreq: 400, midQ: 1, highGain: 2, highFreq: 2500, mix: 1 }, confidence: 0.9 },
    { type: "compressor", reason: "Even bass response", params: { threshold: -15, ratio: 5, attack: 8, release: 80, makeupGain: 3, mix: 1 }, confidence: 0.88 },
    { type: "distortion", reason: "Optional grit", params: { drive: 0.2, tone: 0.4, mode: 2, level: 0.8, mix: 0.3 }, confidence: 0.7 },
  ],
  "ambient": [
    { type: "eq", reason: "Remove harshness", params: { lowGain: -4, lowFreq: 300, midGain: 0, midFreq: 1000, midQ: 1, highGain: 6, highFreq: 6000, mix: 1 }, confidence: 0.85 },
    { type: "chorus", reason: "Ethereal width", params: { rate: 0.3, depth: 0.6, voices: 3, mix: 0.4 }, confidence: 0.88 },
    { type: "delay", reason: "Spacious atmosphere", params: { time: 500, feedback: 0.55, damping: 0.4, mix: 0.4 }, confidence: 0.92 },
  ],
};

export function AIEffectSuggester({
  analyser,
  onApplySuggestion,
  onApplyChain,
  currentGenre = "indie-pop",
  className
}: AIEffectSuggesterProps) {
  const [suggestions, setSuggestions] = useState<EffectSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalyzedGenre, setLastAnalyzedGenre] = useState<string | null>(null);

  const analyzAndSuggest = useCallback(async () => {
    setIsAnalyzing(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 800));

    const allSuggestions: EffectSuggestion[] = [];

    // Get genre-based suggestions
    const genrePresets = GENRE_EFFECT_PRESETS[currentGenre] || GENRE_EFFECT_PRESETS["indie-pop"];
    allSuggestions.push(...genrePresets);

    // If we have an analyser, add dynamic suggestions based on audio analysis
    if (analyser) {
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);
      const profile = analyzeFrequencyProfile(frequencyData);
      const dynamicSuggestions = generateDynamicSuggestions(profile);
      allSuggestions.push(...dynamicSuggestions);
    }

    // Sort by confidence and remove duplicates
    const uniqueSuggestions = allSuggestions
      .reduce((acc, curr) => {
        const existing = acc.find(s => s.type === curr.type);
        if (!existing || existing.confidence < curr.confidence) {
          return [...acc.filter(s => s.type !== curr.type), curr];
        }
        return acc;
      }, [] as EffectSuggestion[])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4);

    setSuggestions(uniqueSuggestions);
    setLastAnalyzedGenre(currentGenre);
    setIsAnalyzing(false);
  }, [analyser, currentGenre]);

  const handleApply = (suggestion: EffectSuggestion) => {
    onApplySuggestion(suggestion.type, suggestion.params);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (confidence >= 0.7) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Effect Suggestions
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={analyzAndSuggest}
            disabled={isAnalyzing}
            className="h-7 text-xs"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="w-3 h-3 mr-1" />
                Analyze
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click "Analyze" to get AI-powered effect suggestions</p>
            <p className="text-xs mt-1">Based on genre: <span className="text-primary">{currentGenre}</span></p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Suggestions for <span className="text-primary font-medium">{lastAnalyzedGenre}</span>
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.type}-${idx}`}
                  className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm capitalize">{suggestion.type}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {suggestion.reason}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleApply(suggestion)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Apply All Button */}
            {onApplyChain && suggestions.length > 1 && (
              <Button
                className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500"
                onClick={() => onApplyChain(suggestions)}
              >
                <Play className="w-4 h-4 mr-2" />
                Apply All ({suggestions.length} effects)
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
