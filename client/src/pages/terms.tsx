/**
 * Terms of Service Page
 * AudioNoise Web Terms of Service
 */

import { motion } from 'framer-motion';
import { ChevronLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

export default function Terms() {
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
            <div className="p-3 rounded-full bg-purple-500/20">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
              <p className="text-gray-400">Last updated: January 2026</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-6">
            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                By accessing or using AudioNoise Web, you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">2. Description of Service</h2>
              <p className="text-gray-300 leading-relaxed">
                AudioNoise Web is a browser-based audio processing application that provides:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside mt-4">
                <li>Real-time audio DSP effects processing</li>
                <li>Audio recording and playback functionality</li>
                <li>Effect preset creation and sharing</li>
                <li>Community features for sharing recordings</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">3. User Accounts</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                To access certain features, you must create an account. You agree to:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">4. User Content</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                When you upload or share content (recordings, presets), you:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Retain ownership of your original content</li>
                <li>Grant us a license to store and serve your public content</li>
                <li>Confirm you have rights to share the content</li>
                <li>Accept responsibility for your shared content</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">5. Prohibited Uses</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="text-gray-300 space-y-2 list-disc list-inside">
                <li>Upload content that infringes on copyrights or intellectual property</li>
                <li>Share harmful, offensive, or illegal content</li>
                <li>Attempt to circumvent security measures</li>
                <li>Use the service for commercial purposes without permission</li>
                <li>Harass or abuse other users</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-300 leading-relaxed">
                AudioNoise Web is based on open-source DSP algorithms (GPL v2). The web application
                interface, design, and original code are protected by applicable intellectual property laws.
                The underlying audio processing algorithms are derived from torvalds/AudioNoise.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">7. Privacy</h2>
              <p className="text-gray-300 leading-relaxed">
                Your use of AudioNoise Web is also governed by our{' '}
                <a href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">
                  Privacy Policy
                </a>
                . Please review it to understand how we collect and use your information.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-gray-300 leading-relaxed">
                AudioNoise Web is provided "as is" without warranties of any kind. We do not guarantee
                that the service will be uninterrupted, secure, or error-free. Use at your own risk.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                To the maximum extent permitted by law, we shall not be liable for any indirect,
                incidental, special, or consequential damages arising from your use of the service.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">10. Termination</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to suspend or terminate your account at any time for violations
                of these terms or for any other reason at our discretion. You may also delete your
                account at any time.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">11. Changes to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                We may modify these terms at any time. Continued use of the service after changes
                constitutes acceptance of the new terms. We will notify users of significant changes.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-purple-400 mb-4">12. Contact</h2>
              <p className="text-gray-300 leading-relaxed">
                For questions about these Terms of Service, please contact us at:{' '}
                <a href="mailto:nick@spacechild.love" className="text-cyan-400 hover:text-cyan-300 underline">
                  nick@spacechild.love
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Button
              onClick={() => navigate('/')}
              className=""
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
