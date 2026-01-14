/**
 * Virtual Knob Component
 * Touch/gesture-enabled rotary control for DSP parameters
 * Supports mouse drag, touch, and scroll wheel
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VirtualKnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  unit?: string;
  color?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

const SIZES = {
  sm: { outer: 48, inner: 36, indicator: 4, fontSize: 'text-[10px]' },
  md: { outer: 64, inner: 48, indicator: 5, fontSize: 'text-xs' },
  lg: { outer: 80, inner: 60, indicator: 6, fontSize: 'text-sm' },
};

export function VirtualKnob({
  value,
  min,
  max,
  step = 1,
  size = 'md',
  label,
  unit,
  color = 'cyan',
  disabled = false,
  onChange,
  className,
}: VirtualKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(value);

  const sizeConfig = SIZES[size];
  
  // Convert value to rotation angle (0-270 degrees, starting from bottom-left)
  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const clampValue = useCallback((val: number) => {
    const stepped = Math.round(val / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [min, max, step]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
  }, [disabled, value]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setStartValue(value);
  }, [disabled, value]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    
    const deltaY = startY - clientY;
    const sensitivity = (max - min) / 150; // Pixels to full range
    const newValue = clampValue(startValue + deltaY * sensitivity);
    
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [isDragging, startY, startValue, max, min, clampValue, value, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    const newValue = clampValue(value + delta * 3);
    onChange(newValue);
  }, [disabled, value, step, clampValue, onChange]);

  // Double-click to reset to center
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    const centerValue = clampValue((min + max) / 2);
    onChange(centerValue);
  }, [disabled, min, max, clampValue, onChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd]);

  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500 to-cyan-400',
    purple: 'from-purple-500 to-purple-400',
    pink: 'from-pink-500 to-pink-400',
    green: 'from-green-500 to-green-400',
    orange: 'from-orange-500 to-orange-400',
    blue: 'from-blue-500 to-blue-400',
    red: 'from-red-500 to-red-400',
  };

  const formatValue = (val: number) => {
    if (step < 1) {
      return val.toFixed(2);
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toFixed(0);
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {/* Knob Container */}
      <div
        ref={knobRef}
        className={cn(
          "relative rounded-full cursor-grab select-none",
          "bg-gradient-to-b from-zinc-700 to-zinc-900",
          "border-2 border-zinc-600",
          "shadow-lg shadow-black/30",
          isDragging && "cursor-grabbing",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ 
          width: sizeConfig.outer, 
          height: sizeConfig.outer,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Tick marks around the edge */}
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
        >
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-800"
            strokeDasharray="4 4"
            transform="rotate(-135 50 50)"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="url(#knobGradient)"
            strokeWidth="3"
            strokeDasharray={`${normalizedValue * 212} 1000`}
            transform="rotate(-135 50 50)"
            strokeLinecap="round"
            className="transition-all duration-75"
          />
          <defs>
            <linearGradient id="knobGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={`text-${color}-500`} stopColor="currentColor" />
              <stop offset="100%" className={`text-${color}-400`} stopColor="currentColor" />
            </linearGradient>
          </defs>
        </svg>

        {/* Inner knob surface */}
        <div
          className={cn(
            "absolute rounded-full",
            "bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800",
            "border border-zinc-500/50",
            "flex items-center justify-center",
            "transition-transform duration-75"
          )}
          style={{
            width: sizeConfig.inner,
            height: sizeConfig.inner,
            left: (sizeConfig.outer - sizeConfig.inner) / 2,
            top: (sizeConfig.outer - sizeConfig.inner) / 2,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {/* Indicator line */}
          <div
            className={cn(
              "absolute rounded-full bg-gradient-to-r",
              colorClasses[color] || colorClasses.cyan
            )}
            style={{
              width: sizeConfig.indicator,
              height: sizeConfig.inner / 3,
              top: 4,
              left: '50%',
              marginLeft: -sizeConfig.indicator / 2,
            }}
          />
        </div>

        {/* Glow effect when dragging */}
        {isDragging && (
          <div 
            className={cn(
              "absolute inset-0 rounded-full opacity-30",
              `bg-${color}-500 blur-md`
            )}
          />
        )}
      </div>

      {/* Value display */}
      <div className={cn(
        "text-center font-mono tabular-nums",
        sizeConfig.fontSize,
        disabled ? "text-muted-foreground/50" : "text-foreground"
      )}>
        <span className="font-semibold">{formatValue(value)}</span>
        {unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
      </div>

      {/* Label */}
      {label && (
        <div className={cn(
          "text-center text-muted-foreground uppercase tracking-wider",
          size === 'sm' ? 'text-[8px]' : 'text-[10px]'
        )}>
          {label}
        </div>
      )}
    </div>
  );
}
