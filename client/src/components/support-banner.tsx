import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Copy, Check, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ETH_ADDRESS = "REDACTED_WALLET_ADDRESS";

interface SupportBannerProps {
  className?: string;
}

export function SupportBanner({ className }: SupportBannerProps) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (dismissed) return null;

  return (
    <Card className={cn(
      "border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-cyan-500/5 to-purple-500/5",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Support SonicVision</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Help us build the future of AI music creation. Donations support new features, 
              DSP effects, and keeping the project free for everyone.
            </p>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background/80 border text-xs font-mono">
                <svg className="w-4 h-4" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#343434" d="m127.961 0-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
                  <path fill="#8C8C8C" d="M127.962 0 0 212.32l127.962 75.639V154.158z"/>
                  <path fill="#3C3C3B" d="m127.961 312.187-1.575 1.92v98.199l1.575 4.6L256 236.587z"/>
                  <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z"/>
                  <path fill="#141414" d="m127.961 287.958 127.96-75.637-127.96-58.162z"/>
                  <path fill="#393939" d="m.001 212.321 127.96 75.637V154.159z"/>
                </svg>
                <span className="truncate max-w-[180px]">{ETH_ADDRESS}</span>
              </div>
              
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={copyAddress}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                asChild
              >
                <a 
                  href={`https://etherscan.io/address/${ETH_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Etherscan
                </a>
              </Button>
            </div>
            
            <p className="text-[10px] text-muted-foreground mt-2">
              Works with ETH, Polygon, Base, Arbitrum, and all EVM chains
            </p>
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
