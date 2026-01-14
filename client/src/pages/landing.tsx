/**
 * SonicVision Landing Page
 * Beautiful, inspiring landing with 3D visuals, Auth, and PWA
 * Free and open source under GPL v2
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Music, Sparkles, Zap, Waves, Volume2, Download, 
  ArrowRight, Star, Headphones, Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AudioWaveScene } from '@/components/landing/AudioWaveScene';
import { SpaceChildAuthModal } from '@/components/auth';
import { PWAInstallPrompt, OfflineIndicator, UpdateBanner } from '@/components/pwa';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useLocation } from 'wouter';

export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const { user, isAuthenticated } = useSpaceChildAuth();
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/studio');
    } else {
      setAuthMode('signup');
      setAuthOpen(true);
    }
  };

  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'AI Music Generation',
      description: 'Create stunning original music with state-of-the-art AI models',
    },
    {
      icon: <Waves className="w-6 h-6" />,
      title: 'AudioNoise DSP',
      description: 'Professional-grade real-time audio effects powered by AudioNoise',
    },
    {
      icon: <Sliders className="w-6 h-6" />,
      title: 'Real-time Processing',
      description: 'Apply effects in real-time with zero latency audio processing',
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: 'Hi-Fi Export',
      description: 'Export your creations in studio-quality WAV and 320kbps MP3',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Stem Separation',
      description: 'Extract vocals, drums, bass, and other instruments from any track',
    },
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Install as App',
      description: 'Works offline as a Progressive Web App on any device',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0118] text-white overflow-x-hidden">
      {/* PWA Components */}
      <PWAInstallPrompt appName="SonicVision" />
      <OfflineIndicator />
      <UpdateBanner />
      
      {/* Auth Modal */}
      <SpaceChildAuthModal open={authOpen} onOpenChange={setAuthOpen} />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center">
        <AudioWaveScene />
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">Powered by AudioNoise DSP</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Create Music with AI
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-10">
              Transform your ideas into stunning audio with next-gen AI music generation 
              and professional DSP effects
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="text-lg px-8 py-6 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 border-0"
              >
                <Music className="w-5 h-5 mr-2" />
                Start Creating Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              {!isAuthenticated && (
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
                  className="text-lg px-8 py-6 border-white/20 bg-white/5 hover:bg-white/10"
                >
                  Sign In
                </Button>
              )}
            </div>
            
            {isAuthenticated && user && (
              <p className="mt-6 text-gray-400">
                Welcome back, <span className="text-cyan-400">{user.firstName || user.email}</span>
              </p>
            )}
          </motion.div>
        </div>
        
        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white/50 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#0a0118] to-[#1a0a2e]">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-xl text-gray-400">
              Professional music production tools in your browser
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 bg-white/5 border-white/10 hover:border-cyan-500/50 transition-all hover:bg-white/10 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-cyan-400 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / Social Proof */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#1a0a2e] to-[#0a0118]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <blockquote className="text-2xl md:text-3xl font-light mb-6 text-gray-200">
              "SonicVision has completely transformed how I create music. 
              The AI generation combined with the AudioNoise DSP effects is 
              <span className="text-cyan-400"> absolutely incredible</span>."
            </blockquote>
            <p className="text-gray-400">
              — Independent Music Producer
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-[#0a0118]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Create?
            </h2>
            <p className="text-xl text-gray-400 mb-10">
              Join thousands of creators making music with SonicVision
            </p>
            <Button 
              size="lg"
              onClick={handleGetStarted}
              className="text-lg px-10 py-6 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Creating Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-cyan-400" />
            <span className="font-bold text-xl">SonicVision</span>
            <span className="text-gray-500 text-sm">powered by AudioNoise DSP</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            <a 
              href="https://etherscan.io/address/REDACTED_WALLET_ADDRESS"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Donate ETH
            </a>
          </div>
          
          <p className="text-sm text-gray-500">
            © 2025 SonicVision. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
