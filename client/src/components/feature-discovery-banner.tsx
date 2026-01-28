/**
 * Feature Discovery Banner
 * Shows authenticated users what features are now available to them
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Mic, Music, Users, Wand2, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureDiscoveryBannerProps {
  isAuthenticated: boolean;
  onNavigateToRecordings?: () => void;
  className?: string;
}

const FEATURES = [
  {
    icon: <Mic className="w-5 h-5" />,
    title: 'Record Audio',
    description: 'Capture your processed audio with full effect chain',
    color: 'text-red-400',
  },
  {
    icon: <Library className="w-5 h-5" />,
    title: 'My Recordings',
    description: 'Save, organize, and share your recordings',
    color: 'text-cyan-400',
  },
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: 'AI Effect Designer',
    description: 'Describe sounds and get AI-generated effect chains',
    color: 'text-purple-400',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Team Workspaces',
    description: 'Collaborate with others in shared workspaces',
    color: 'text-green-400',
  },
];

const STORAGE_KEY = 'audionoise-feature-banner-dismissed';

export function FeatureDiscoveryBanner({
  isAuthenticated,
  onNavigateToRecordings,
  className,
}: FeatureDiscoveryBannerProps) {
  const [dismissed, setDismissed] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      // Check if user has seen the banner before
      const wasDismissed = localStorage.getItem(STORAGE_KEY);
      if (!wasDismissed) {
        setDismissed(false);
        setJustLoggedIn(true);
      }
    }
  }, [isAuthenticated]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!isAuthenticated || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn("relative", className)}
        >
          <Card className="p-4 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-green-500/10 border-purple-500/20">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="absolute top-2 right-2 h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Welcome! Here's what you can do now:</h3>
                <p className="text-sm text-muted-foreground">
                  As a signed-in user, you have access to these features
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FEATURES.map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-3 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors cursor-pointer"
                  onClick={() => {
                    if (feature.title === 'My Recordings' && onNavigateToRecordings) {
                      onNavigateToRecordings();
                      handleDismiss();
                    }
                  }}
                >
                  <div className={cn("mb-2", feature.color)}>{feature.icon}</div>
                  <h4 className="text-sm font-medium">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={handleDismiss}>
                Got it, thanks!
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FeatureDiscoveryBanner;
