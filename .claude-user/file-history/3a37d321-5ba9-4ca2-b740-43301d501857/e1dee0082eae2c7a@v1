/**
 * Level Meter Component
 * Displays peak and RMS audio levels with professional styling
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface LevelMeterProps {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  orientation?: 'horizontal' | 'vertical';
  showPeak?: boolean;
  showRms?: boolean;
  stereo?: boolean;
  label?: string;
  className?: string;
}

function dbFromLinear(linear: number): number {
  if (linear <= 0) return -60;
  return Math.max(-60, 20 * Math.log10(linear));
}

function linearFromDb(db: number): number {
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

interface MeterBarProps {
  level: number; // 0 to 1
  peak: number;  // 0 to 1
  orientation: 'horizontal' | 'vertical';
  showPeak: boolean;
}

function MeterBar({ level, peak, orientation, showPeak }: MeterBarProps) {
  const levelPercent = Math.min(100, level * 100);
  const peakPercent = Math.min(100, peak * 100);

  // Color gradient based on level
  const getGradient = () => {
    if (orientation === 'vertical') {
      return 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 85%, #ef4444 85%, #ef4444 100%)';
    }
    return 'linear-gradient(to right, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 85%, #ef4444 85%, #ef4444 100%)';
  };

  if (orientation === 'vertical') {
    return (
      <div className="relative w-4 h-full bg-muted rounded-sm overflow-hidden">
        {/* Level bar */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-75"
          style={{
            height: `${levelPercent}%`,
            background: getGradient(),
            clipPath: `inset(${100 - levelPercent}% 0 0 0)`,
          }}
        />
        {/* Peak indicator */}
        {showPeak && peakPercent > 0 && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] transition-all duration-150"
            style={{ bottom: `${peakPercent}%` }}
          />
        )}
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full h-px bg-foreground/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-4 w-full bg-muted rounded-sm overflow-hidden">
      {/* Level bar */}
      <div
        className="absolute top-0 bottom-0 left-0 transition-all duration-75"
        style={{
          width: `${levelPercent}%`,
          background: getGradient(),
          clipPath: `inset(0 ${100 - levelPercent}% 0 0)`,
        }}
      />
      {/* Peak indicator */}
      {showPeak && peakPercent > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] transition-all duration-150"
          style={{ left: `${peakPercent}%` }}
        />
      )}
    </div>
  );
}

export function LevelMeter({
  peakL,
  peakR,
  rmsL,
  rmsR,
  orientation = 'vertical',
  showPeak = true,
  showRms = true,
  stereo = true,
  label,
  className,
}: LevelMeterProps) {
  // Convert to dB and then to 0-1 range for display
  const peakLDb = dbFromLinear(peakL);
  const peakRDb = dbFromLinear(peakR);
  const rmsLDb = dbFromLinear(rmsL);
  const rmsRDb = dbFromLinear(rmsR);

  const peakLNorm = linearFromDb(peakLDb);
  const peakRNorm = linearFromDb(peakRDb);
  const rmsLNorm = linearFromDb(rmsLDb);
  const rmsRNorm = linearFromDb(rmsRDb);

  // Use RMS for level, peak for peak indicator
  const levelL = showRms ? rmsLNorm : peakLNorm;
  const levelR = showRms ? rmsRNorm : peakRNorm;

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <div className="flex gap-1 h-24">
          <MeterBar
            level={levelL}
            peak={peakLNorm}
            orientation="vertical"
            showPeak={showPeak}
          />
          {stereo && (
            <MeterBar
              level={levelR}
              peak={peakRNorm}
              orientation="vertical"
              showPeak={showPeak}
            />
          )}
        </div>
        {label && (
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        )}
        <div className="text-xs font-mono text-muted-foreground">
          {peakLDb > -60 ? `${peakLDb.toFixed(1)}` : '-∞'} dB
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="text-xs font-mono text-muted-foreground">
            {peakLDb > -60 ? `${peakLDb.toFixed(1)} dB` : '-∞ dB'}
          </span>
        </div>
      )}
      <div className="space-y-1">
        <MeterBar
          level={levelL}
          peak={peakLNorm}
          orientation="horizontal"
          showPeak={showPeak}
        />
        {stereo && (
          <MeterBar
            level={levelR}
            peak={peakRNorm}
            orientation="horizontal"
            showPeak={showPeak}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Combined Input/Output Level Meter Display
 */
export interface DualLevelMeterProps {
  inputLevels: {
    peakL: number;
    peakR: number;
    rmsL: number;
    rmsR: number;
  };
  outputLevels: {
    peakL: number;
    peakR: number;
    rmsL: number;
    rmsR: number;
  };
  className?: string;
}

export function DualLevelMeter({ inputLevels, outputLevels, className }: DualLevelMeterProps) {
  return (
    <div className={cn('flex items-end gap-6 justify-center', className)}>
      <LevelMeter
        peakL={inputLevels.peakL}
        peakR={inputLevels.peakR}
        rmsL={inputLevels.rmsL}
        rmsR={inputLevels.rmsR}
        orientation="vertical"
        label="IN"
        stereo={true}
      />
      <LevelMeter
        peakL={outputLevels.peakL}
        peakR={outputLevels.peakR}
        rmsL={outputLevels.rmsL}
        rmsR={outputLevels.rmsR}
        orientation="vertical"
        label="OUT"
        stereo={true}
      />
    </div>
  );
}
