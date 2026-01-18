/**
 * Privacy Policy Page
 * AudioNoise Web Privacy Policy
 */

import { motion } from 'framer-motion';
import { ChevronLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

export default function Privacy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between h-16 px-6 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl">AudioNoise Web</span>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Privacy Policy</h1>
              <p className="text-gray-400">Last updated: January 2026</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-6">
            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">1. Introduction</h2>
              <p className="text-gray-300 leading-relaxed">
                Welcome to AudioNoise Web. We respect your privacy and are committed to protecting your personal data.
                This privacy policy explains how we collect, use, and safeguard your information when you use our
                audio processing application.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">2. Information We Collect</h2>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li><strong>Account Information:</strong> Email address, name, and password (securely hashed)</li>
                <li><strong>Audio Recordings:</strong> Audio files you choose to record and save through our platform</li>
                <li><strong>Effect Presets:</strong> Custom audio effect configurations you create and save</li>
                <li><strong>Usage Data:</strong> Anonymous analytics to improve our service</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Provide and maintain our audio processing services</li>
                <li>Store your recordings and presets securely</li>
                <li>Enable sharing features when you choose to make content public</li>
                <li>Send important service notifications</li>
                <li>Improve our application based on usage patterns</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">4. Data Security</h2>
              <p className="text-gray-300 leading-relaxed">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside mt-4">
                <li>Zero-Knowledge Proof (ZKP) authentication - your password never leaves your device</li>
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure password hashing with bcrypt</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">5. Your Rights</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Export your recordings and presets</li>
                <li>Control the visibility of your shared content</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">6. Cookies and Local Storage</h2>
              <p className="text-gray-300 leading-relaxed">
                We use local storage to save your authentication tokens and app preferences.
                This data stays on your device and is used only to maintain your session and settings.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">7. Third-Party Services</h2>
              <p className="text-gray-300 leading-relaxed">
                AudioNoise Web may integrate with optional third-party services (e.g., AI effect suggestions).
                When you choose to use these features, your interaction with those services is governed by
                their respective privacy policies.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">8. Contact Us</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at:{' '}
                <a href="mailto:nick@spacechild.love" className="text-cyan-400 hover:text-cyan-300 underline">
                  nick@spacechild.love
                </a>
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">9. Changes to This Policy</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any changes by
                posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
            >
              Back to Home
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          © 2025 AudioNoise Web. GPL v2 License.
        </div>
      </footer>
    </div>
  );
}
