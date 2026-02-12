/**
 * AudioNoise Web Pricing Page
 * Subscription tiers for the audio DSP platform
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Sparkles, Zap, Crown,
  ChevronDown, ChevronUp, HelpCircle,
  Waves, Database, Bot, Users, Headphones, FileAudio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useLocation } from 'wouter';

import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

type PlanType = 'free' | 'pro' | 'studio';

interface PricingTier {
  id: PlanType;
  name: string;
  price: string;
  priceValue: number;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  features: string[];
  exportFormats: string[];
  cta: string;
  highlighted?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceValue: 0,
    description: 'Get started with essential audio effects',
    icon: <Waves className="w-6 h-6" />,
    features: [
      '3 effects',
      '5 recordings',
      '100MB storage',
      '10 AI requests/mo',
    ],
    exportFormats: ['WAV'],
    cta: 'Get Started',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    priceValue: 9.99,
    description: 'Professional tools for serious creators',
    icon: <Zap className="w-6 h-6" />,
    badge: 'Most Popular',
    features: [
      '10 effects',
      '50 recordings',
      '2GB storage',
      '100 AI requests/mo',
      'API access',
    ],
    exportFormats: ['WAV', 'MP3', 'OGG'],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$19.99',
    priceValue: 19.99,
    description: 'Complete solution for teams and professionals',
    icon: <Crown className="w-6 h-6" />,
    badge: 'Best Value',
    features: [
      'Unlimited effects',
      'Unlimited recordings',
      '20GB storage',
      'Unlimited AI requests',
      'Team workspaces',
      'Priority support',
    ],
    exportFormats: ['WAV', 'MP3', 'OGG', 'FLAC'],
    cta: 'Go Studio',
  },
];

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Can I change my plan at any time?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. When upgrading, you\'ll be charged the prorated difference. When downgrading, the change takes effect at the start of your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and cryptocurrency payments including ETH and BTC.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer: 'Yes! Both Pro and Studio plans come with a 14-day free trial. No credit card required to start your trial.',
  },
  {
    question: 'What happens to my recordings if I downgrade?',
    answer: 'Your recordings are preserved but become read-only if they exceed your new plan\'s limits. You\'ll need to delete some recordings or upgrade to regain full access.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 30-day money-back guarantee for all paid plans. If you\'re not satisfied, contact support for a full refund.',
  },
  {
    question: 'What\'s included in API access?',
    answer: 'API access (Pro and above) allows you to integrate AudioNoise DSP effects into your own applications. You get RESTful endpoints for all effects, batch processing, and webhooks.',
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {faqItems.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          <Card
            className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-cyan-400" />
                  {item.question}
                </CardTitle>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </CardHeader>
            {openIndex === index && (
              <CardContent className="pt-0">
                <p className="text-gray-400">{item.answer}</p>
              </CardContent>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export default function Pricing() {
  const { toast } = useToast();
  const { isAuthenticated } = useSpaceChildAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<PlanType | null>(null);

  const handleSelectPlan = async (plan: PlanType) => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to select a plan.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    if (plan === 'free') {
      toast({
        title: 'Free Plan Active',
        description: 'You are currently on the free plan.',
      });
      return;
    }

    setLoading(plan);

    try {
      const response = await apiRequest('POST', '/api/v1/billing/checkout', {
        plan,
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: 'Success',
          description: `Successfully selected the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      {/* Header */}
      <header className="py-6 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={alienOctopusLogo} alt="AudioNoise Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl">AudioNoise Web</span>
          </a>
          <nav className="flex items-center gap-4">
            <a href="/studio" className="text-gray-400 hover:text-white transition-colors">
              Studio
            </a>
            <a href="/support" className="text-gray-400 hover:text-white transition-colors">
              Support
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">Simple, transparent pricing</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Start free and scale as you grow. All plans include access to our core DSP engine.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card
                  className={`relative h-full flex flex-col ${
                    tier.highlighted
                      ? 'bg-gradient-to-b from-cyan-500/20 to-purple-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge
                        variant={tier.highlighted ? 'default' : 'secondary'}
                        className={tier.highlighted ? 'bg-cyan-500 text-white' : ''}
                      >
                        {tier.badge}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 ${
                      tier.highlighted
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {tier.icon}
                    </div>
                    <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                    <CardDescription className="text-gray-400">{tier.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <span className="text-5xl font-bold text-white">{tier.price}</span>
                      <span className="text-gray-400">/mo</span>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-gray-300">
                          <Check className={`w-5 h-5 flex-shrink-0 ${
                            tier.highlighted ? 'text-cyan-400' : 'text-green-400'
                          }`} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-white/10 pt-4">
                      <p className="text-sm text-gray-500 mb-2">Export formats:</p>
                      <div className="flex flex-wrap gap-2">
                        {tier.exportFormats.map((format) => (
                          <Badge
                            key={format}
                            variant="outline"
                            className="text-xs border-white/20 text-gray-300"
                          >
                            <FileAudio className="w-3 h-3 mr-1" />
                            {format}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${
                        tier.highlighted
                          ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                          : ''
                      }`}
                      variant={tier.highlighted ? 'default' : 'glass'}
                      size="lg"
                      onClick={() => handleSelectPlan(tier.id)}
                      disabled={loading !== null}
                    >
                      {loading === tier.id ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                          Processing...
                        </span>
                      ) : (
                        tier.cta
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison Summary */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-lg bg-white/5 border border-white/10"
            >
              <Waves className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">DSP Effects</h3>
              <p className="text-sm text-gray-400">Professional audio processing</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="p-6 rounded-lg bg-white/5 border border-white/10"
            >
              <Database className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Cloud Storage</h3>
              <p className="text-sm text-gray-400">Secure recording storage</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="p-6 rounded-lg bg-white/5 border border-white/10"
            >
              <Bot className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">AI Assistance</h3>
              <p className="text-sm text-gray-400">Smart effect suggestions</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="p-6 rounded-lg bg-white/5 border border-white/10"
            >
              <Users className="w-8 h-8 text-orange-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Team Workspaces</h3>
              <p className="text-sm text-gray-400">Collaborate with others</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400">
              Everything you need to know about our pricing and plans.
            </p>
          </motion.div>

          <FAQSection />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Headphones className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Audio?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of creators using AudioNoise Web for professional audio processing.
            </p>
            <Button
              size="lg"
              className="text-lg px-10 py-6 bg-cyan-500 hover:bg-cyan-600 text-white"
              onClick={() => handleSelectPlan('pro')}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Your Free Trial
            </Button>
            <p className="text-sm text-gray-500 mt-4">
              14-day free trial. No credit card required.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={alienOctopusLogo} alt="AudioNoise Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl">AudioNoise Web</span>
            <span className="text-gray-500 text-sm">ported from torvalds/AudioNoise</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/support" className="hover:text-white transition-colors">Support</a>
            <a
              href={`https://etherscan.io/address/${import.meta.env.VITE_DONATION_ETH_ADDRESS || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Donate ETH
            </a>
          </div>

          <p className="text-sm text-gray-500">
            &copy; 2025 AudioNoise Web. GPL v2 License.
          </p>
        </div>
      </footer>
    </div>
  );
}
