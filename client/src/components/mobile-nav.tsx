/**
 * Mobile Navigation Component
 * Bottom tab bar for mobile devices with gesture-friendly design
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, Waves, Bluetooth, Clock, Sparkles, 
  PenTool, Menu, X, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeView: 'dsp' | 'routing';
  onViewChange: (view: 'dsp' | 'routing') => void;
  onOpenPrompt?: () => void;
  onOpenHistory?: () => void;
  isGenerating?: boolean;
}

export function MobileNav({ 
  activeView, 
  onViewChange, 
  onOpenPrompt,
  onOpenHistory,
  isGenerating = false 
}: MobileNavProps) {
  const tabs = [
    { id: 'dsp' as const, label: 'Effects', icon: Waves },
    { id: 'routing' as const, label: 'Channels', icon: Bluetooth },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Main Tabs */}
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all active:scale-95",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
              <span className={cn(
                "text-[10px] mt-0.5 font-medium",
                isActive && "text-primary"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}

      </div>
    </nav>
  );
}

/**
 * Mobile Header Component
 * Compact header for mobile with branding and quick actions
 */
interface MobileHeaderProps {
  title?: string;
  onMenuClick?: () => void;
  onHomeClick?: () => void;
}

export function MobileHeader({ title = "AudioNoise", onMenuClick, onHomeClick }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <button 
          onClick={onHomeClick}
          className="flex items-center gap-2 active:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-cyan-500 to-purple-600 bg-clip-text text-transparent">
            {title}
          </span>
        </button>

        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="w-10 h-10">
            <Menu className="w-5 h-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
