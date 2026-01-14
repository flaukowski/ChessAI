/**
 * Effect Picker Component
 * Visual grid-based selector for DSP effects with icons and animations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, Radio, Disc, AudioLines, 
  Sparkles, Check
} from 'lucide-react';
import { EffectType } from '@/hooks/use-audio-dsp';
import { cn } from '@/lib/utils';

interface EffectPickerProps {
  selectedEffect: EffectType | null;
  onSelect: (effect: EffectType) => void;
  onAdd: (effect: EffectType) => void;
  className?: string;
}

const EFFECTS: {
  type: EffectType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}[] = [
  {
    type: 'echo',
    label: 'Echo',
    description: 'Delay with feedback',
    icon: <Waves className="w-6 h-6" />,
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    type: 'flanger',
    label: 'Flanger',
    description: 'Modulated delay sweep',
    icon: <Radio className="w-6 h-6" />,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    type: 'phaser',
    label: 'Phaser',
    description: 'Allpass cascade',
    icon: <Disc className="w-6 h-6" />,
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    type: 'lowpass',
    label: 'Low Pass',
    description: 'Warm tone shaping',
    icon: <AudioLines className="w-6 h-6" />,
    color: 'orange',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    type: 'highpass',
    label: 'High Pass',
    description: 'Clean up mud',
    icon: <AudioLines className="w-6 h-6" />,
    color: 'red',
    gradient: 'from-red-500 to-rose-500',
  },
  {
    type: 'bandpass',
    label: 'Band Pass',
    description: 'Isolate frequencies',
    icon: <AudioLines className="w-6 h-6" />,
    color: 'indigo',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    type: 'notch',
    label: 'Notch',
    description: 'Surgical removal',
    icon: <AudioLines className="w-6 h-6" />,
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-500',
  },
];

export function EffectPicker({ selectedEffect, onSelect, onAdd, className }: EffectPickerProps) {
  const [hoveredEffect, setHoveredEffect] = useState<EffectType | null>(null);

  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {EFFECTS.map((effect) => {
        const isSelected = selectedEffect === effect.type;
        const isHovered = hoveredEffect === effect.type;

        return (
          <motion.button
            key={effect.type}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl",
              "border-2 transition-colors",
              "bg-card/50 backdrop-blur-sm",
              isSelected 
                ? "border-primary bg-primary/10" 
                : "border-border/50 hover:border-border",
              "group cursor-pointer"
            )}
            onClick={() => onSelect(effect.type)}
            onDoubleClick={() => onAdd(effect.type)}
            onMouseEnter={() => setHoveredEffect(effect.type)}
            onMouseLeave={() => setHoveredEffect(null)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Glow effect */}
            <AnimatePresence>
              {(isSelected || isHovered) && (
                <motion.div
                  className={cn(
                    "absolute inset-0 rounded-xl opacity-20 blur-xl bg-gradient-to-r",
                    effect.gradient
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            {/* Icon container */}
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br text-white",
              effect.gradient,
              "shadow-lg",
              isSelected && "ring-2 ring-white/30"
            )}>
              {effect.icon}
            </div>

            {/* Label */}
            <span className={cn(
              "text-xs font-medium transition-colors",
              isSelected ? "text-foreground" : "text-muted-foreground"
            )}>
              {effect.label}
            </span>

            {/* Selected indicator */}
            {isSelected && (
              <motion.div
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3 h-3 text-primary-foreground" />
              </motion.div>
            )}

            {/* Tooltip on hover */}
            <AnimatePresence>
              {isHovered && !isSelected && (
                <motion.div
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-popover border text-[10px] text-muted-foreground whitespace-nowrap z-10"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {effect.description}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}

      {/* AI Suggest Button */}
      <motion.button
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl",
          "border-2 border-dashed border-purple-500/50",
          "bg-gradient-to-br from-purple-500/10 to-pink-500/10",
          "hover:border-purple-500 transition-colors",
          "group cursor-pointer"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
          <Sparkles className="w-6 h-6" />
        </div>
        <span className="text-xs font-medium text-purple-400">AI Pick</span>
      </motion.button>
    </div>
  );
}

export { EFFECTS };
