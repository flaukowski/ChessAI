import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClockIcon, Music, Image, Play, Eye, Clock, Folder, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { POLLING_INTERVAL } from "@/lib/constants";
import type { MusicGeneration, ImageGeneration } from "@shared/schema";

interface GenerationHistoryProps {
  onSelectMusic?: (generation: MusicGeneration) => void;
  onSelectImage?: (generation: ImageGeneration) => void;
  className?: string;
}

type HistoryItem = 
  | (MusicGeneration & { type: 'music' })
  | (ImageGeneration & { type: 'image' });

export function GenerationHistory({ 
  onSelectMusic, 
  onSelectImage, 
  className 
}: GenerationHistoryProps) {
  const [activeTab, setActiveTab] = useState<"all" | "music" | "images">("all");
  const [generations, setGenerations] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch generations
  const fetchGenerations = async () => {
    try {
      const response = await fetch("/api/generations");
      if (!response.ok) throw new Error("Failed to fetch generations");
      
      const data = await response.json();
      setGenerations(data);
    } catch (error) {
      console.error("Error fetching generations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for updates on pending/processing items
  useEffect(() => {
    fetchGenerations();

    const interval = setInterval(() => {
      const hasPendingItems = generations.some(
        gen => gen.status === "pending" || gen.status === "processing"
      );
      
      if (hasPendingItems) {
        fetchGenerations();
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [generations]);

  // Filter generations based on active tab
  const filteredGenerations = generations.filter(gen => {
    if (activeTab === "all") return true;
    if (activeTab === "music") return gen.type === "music";
    if (activeTab === "images") return gen.type === "image";
    return true;
  });

  const handleItemClick = (item: HistoryItem) => {
    if (item.type === "music" && onSelectMusic) {
      onSelectMusic(item as MusicGeneration & { type: 'music' });
    } else if (item.type === "image" && onSelectImage) {
      onSelectImage(item as ImageGeneration & { type: 'image' });
    }
  };

  const formatTimeAgo = (date: Date | string | null) => {
    if (!date) return "Unknown";
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return "Unknown";
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-100";
      case "processing": return "text-yellow-600 bg-yellow-100";
      case "failed": return "text-red-600 bg-red-100";
      default: return "text-blue-600 bg-blue-100";
    }
  };

  return (
    <aside className={cn("w-96 border-l border-border bg-card flex flex-col overflow-hidden md:w-96", className)} data-testid="generation-history">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-primary" />
          Generation History
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Your recent creations</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border px-6">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "all" 
              ? "text-foreground border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-all"
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("music")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "music" 
              ? "text-foreground border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-music"
        >
          Music
        </button>
        <button
          onClick={() => setActiveTab("images")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "images" 
              ? "text-foreground border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-images"
        >
          Images
        </button>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="p-4 rounded-lg border border-border animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-lg bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))
          ) : filteredGenerations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <ClockIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Generations Yet</h3>
              <p className="text-sm text-muted-foreground">Start creating music and images to see your history</p>
            </div>
          ) : (
            filteredGenerations.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "p-4 rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer",
                  item.status === "processing" && "animate-pulse border-yellow-200"
                )}
                data-testid={`history-item-${item.type}-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon/Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                    {item.type === "music" && (item as any).imageUrl ? (
                      <img 
                        src={(item as any).imageUrl} 
                        alt="Track artwork" 
                        className="w-full h-full object-cover" 
                      />
                    ) : item.type === "image" && (item as any).imageUrl ? (
                      <img 
                        src={(item as any).imageUrl} 
                        alt="Generated image" 
                        className="w-full h-full object-cover" 
                      />
                    ) : item.type === "music" ? (
                      <Music className="w-6 h-6 text-primary" />
                    ) : (
                      <Image className="w-6 h-6 text-accent" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1 truncate">
                      {item.title || (item.type === "music" ? "Untitled Track" : "Untitled Image")}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.prompt.length > 60 ? `${item.prompt.substring(0, 60)}...` : item.prompt}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.createdAt)}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(item.status))}>
                        {item.status === "processing" && item.type === "music" && (
                          <div className="w-2 h-2 rounded-full bg-current animate-pulse mr-1 inline-block"></div>
                        )}
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                      {item.type === "music" && (item as any).duration && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {Math.floor((item as any).duration / 60)}:
                            {((item as any).duration % 60).toString().padStart(2, "0")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "flex-shrink-0 w-8 h-8",
                      item.type === "music" 
                        ? "text-primary hover:bg-primary/10" 
                        : "text-accent hover:bg-accent/10"
                    )}
                    data-testid={`button-${item.type}-${item.id}`}
                  >
                    {item.type === "music" ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Progress bar for processing items */}
                {item.status === "processing" && (
                  <div className="mt-3">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full animate-pulse" style={{ width: "65%" }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Processing...</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button variant="outline" className="w-full" data-testid="button-view-all">
          <Folder className="w-4 h-4 mr-2" />
          View All Projects
        </Button>
        <Button variant="outline" className="w-full" data-testid="button-clear-history">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear History
        </Button>
      </div>
    </aside>
  );
}
