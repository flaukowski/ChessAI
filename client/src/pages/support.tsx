/**
 * Support Page
 * Contact form for AudioNoise Web support
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, MessageSquare, Send, CheckCircle, Loader2, Mail, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

export default function Support() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useSpaceChildAuth();

  const [name, setName] = useState(user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = isAuthenticated
        ? '/api/v1/support/contact/auth'
        : '/api/v1/support/contact';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth token if authenticated
      if (isAuthenticated) {
        const token = localStorage.getItem('space-child-access-token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name || undefined,
          email,
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0118] text-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full bg-slate-900 border-green-500/30">
            <CardContent className="pt-12 pb-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Message Sent!</h2>
              <p className="text-gray-400 mb-8">
                Thank you for reaching out. We'll get back to you at <span className="text-cyan-400">{email}</span> as soon as possible.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setSubject('');
                    setMessage('');
                  }}
                  variant="outline"
                  className="border-white/10"
                >
                  Send Another Message
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className=""
                >
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

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
      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <MessageSquare className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Support</h1>
              <p className="text-gray-400">We're here to help</p>
            </div>
          </div>

          <Card className="bg-slate-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Contact Us</CardTitle>
              <CardDescription className="text-gray-400">
                Have a question, feedback, or need assistance? Send us a message and we'll get back to you soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Name (optional)
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="bg-slate-800 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="bg-slate-800 border-white/10 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Subject *
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    className="bg-slate-800 border-white/10 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-gray-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Message *
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us how we can help..."
                    className="bg-slate-800 border-white/10 text-white min-h-[150px]"
                    required
                    minLength={10}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-sm text-gray-400 text-center">
                  You can also reach us directly at{' '}
                  <a
                    href="mailto:nick@spacechild.love"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    nick@spacechild.love
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <a
              href="/privacy"
              className="p-4 bg-slate-800/50 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
            >
              <h3 className="font-medium text-white mb-1">Privacy Policy</h3>
              <p className="text-sm text-gray-400">Learn how we protect your data</p>
            </a>
            <a
              href="/terms"
              className="p-4 bg-slate-800/50 rounded-lg border border-white/10 hover:border-purple-500/50 transition-colors"
            >
              <h3 className="font-medium text-white mb-1">Terms of Service</h3>
              <p className="text-sm text-gray-400">Read our terms and conditions</p>
            </a>
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
