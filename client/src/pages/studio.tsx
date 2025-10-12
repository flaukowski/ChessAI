import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Home, Upload, User, Plus } from "lucide-react";
import { PromptSidebar, type GenerationParams } from "@/components/prompt-sidebar";
import { AudioPlayer } from "@/components/audio-player";
import { ImageGallery } from "@/components/image-gallery";
import { GenerationHistory } from "@/components/generation-history";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MusicGeneration, ImageGeneration } from "@shared/schema";

export default function Studio() {
  const [currentMusic, setCurrentMusic] = useState<MusicGeneration | null>(null);
  const [images, setImages] = useState<ImageGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const response = await fetch("/api/generations/images");
      if (!response.ok) throw new Error("Failed to load images");
      const imageData = await response.json();
      setImages(imageData);
    } catch (error) {
      console.error("Error loading images:", error);
    }
  };

  const handleGenerate = async (params: GenerationParams) => {
    setIsGenerating(true);
    
    try {
      // Generate music
      const response = await apiRequest("POST", "/api/music/generate", {
        prompt: params.prompt,
        style: params.style,
        title: params.title,
        model: params.model,
        instrumental: params.instrumental,
        duration: params.duration,
        metadata: {
          customMode: params.customMode,
          negativeTags: params.negativeTags,
          vocalGender: params.vocalGender,
          styleWeight: params.styleWeight,
          weirdnessConstraint: params.weirdnessConstraint,
        },
      });

      const musicGeneration: MusicGeneration = await response.json();
      setCurrentMusic(musicGeneration);

      toast({
        title: "Music Generation Started",
        description: "Your track is being generated. This may take up to 2 minutes.",
      });

      // Stream live status via SSE with polling fallback
      startMusicStatus(musicGeneration.id, musicGeneration.prompt ?? "");

    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation Failed", 
        description: error instanceof Error ? error.message : "Failed to generate music",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const startMusicStatus = (musicId: string, originalPrompt: string) => {
    try {
      const es = new EventSource(`/api/music/${musicId}/events`);

      const onStatus = (evt: MessageEvent) => {
        try {
          const updated: MusicGeneration = JSON.parse((evt as MessageEvent).data);
          setCurrentMusic(updated);
          if (updated.status === "completed") {
            es.close();
            if (updated.prompt || originalPrompt) {
              generatePairedImage(updated);
            }
          } else if (updated.status === "failed") {
            es.close();
            toast({
              title: "Generation Failed",
              description: "The music generation encountered an error.",
              variant: "destructive",
            });
          }
        } catch (e) {
          // swallow parse errors
        }
      };

      es.addEventListener("status", onStatus as EventListener);
      es.addEventListener("error", () => {
        es.close();
        // fallback to polling if SSE fails
        pollMusicStatus(musicId);
      });
    } catch (_e) {
      // If EventSource unsupported, fallback to polling
      pollMusicStatus(musicId);
    }
  };

  const pollMusicStatus = async (musicId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/music/${musicId}/status`);
        if (!response.ok) throw new Error("Failed to check status");
        
        const updatedMusic: MusicGeneration = await response.json();
        setCurrentMusic(updatedMusic);

        if (updatedMusic.status === "completed") {
          toast({
            title: "Music Generation Complete!",
            description: `"${updatedMusic.title || 'Your track'}" is ready to play.`,
          });

          // Generate paired image
          if (updatedMusic.prompt) {
            generatePairedImage(updatedMusic);
          }
        } else if (updatedMusic.status === "failed") {
          toast({
            title: "Generation Failed",
            description: "The music generation encountered an error.",
            variant: "destructive",
          });
        } else if (updatedMusic.status === "processing" || updatedMusic.status === "pending") {
          // Continue polling
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error("Status check error:", error);
      }
    };

    checkStatus();
  };

  const generatePairedImage = async (musicGeneration: MusicGeneration) => {
    try {
      const imagePrompt = `Visual representation of ${musicGeneration.style || 'music'} with the mood: ${musicGeneration.prompt.substring(0, 200)}`;
      
      await apiRequest("POST", "/api/images/generate", {
        prompt: imagePrompt,
        title: `Visual for "${musicGeneration.title || 'Untitled'}"`,
        musicGenerationId: musicGeneration.id,
      });

      // Refresh images
      loadImages();

      toast({
        title: "Paired Image Generated",
        description: "Visual artwork has been created to match your music.",
      });
    } catch (error) {
      console.error("Image generation error:", error);
      // Don't show error toast for image generation as it's secondary
    }
  };

  const handleSelectMusic = (generation: MusicGeneration) => {
    setCurrentMusic(generation);
  };

  const handleSelectImage = (generation: ImageGeneration) => {
    // Could implement image viewing/editing functionality
    console.log("Selected image:", generation);
  };

  const handleQuickGenerate = () => {
    // Quick generate with default parameters
    const quickParams: GenerationParams = {
      prompt: "An upbeat, energetic song with modern production",
      style: "indie-pop",
      title: "",
      model: "V5",
      instrumental: false,
      duration: 180,
      customMode: false,
      negativeTags: "",
      vocalGender: undefined,
      styleWeight: 0.65,
      weirdnessConstraint: 0.5,
    };
    handleGenerate(quickParams);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground" data-testid="studio-page">
      
      {/* Left Sidebar - Prompt & Controls */}
      <PromptSidebar 
        onGenerate={handleGenerate} 
        isGenerating={isGenerating}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Home className="w-4 h-4" />
              <span>/</span>
              <span className="text-foreground font-medium">Studio</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" data-testid="button-export">
              <Upload className="w-4 h-4 mr-2" />
              Export All
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              data-testid="button-user"
            >
              <User className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Audio Player Section */}
          <AudioPlayer 
            musicGeneration={currentMusic}
            className="hover:shadow-xl transition-shadow" 
          />

          {/* Image Gallery Section */}
          <ImageGallery 
            images={images}
            className="hover:shadow-xl transition-shadow"
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="p-4 h-auto text-left group hover:border-primary/50 hover:bg-primary/5"
              data-testid="button-remix"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary/10 to-purple-600/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 bg-primary/20 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Remix Track</h3>
                <p className="text-xs text-muted-foreground">Create variations of your song</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="p-4 h-auto text-left group hover:border-accent/50 hover:bg-accent/5"
              data-testid="button-vocals"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-accent/10 to-blue-600/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 bg-accent/20 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Add Vocals</h3>
                <p className="text-xs text-muted-foreground">Generate vocal layers</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="p-4 h-auto text-left group hover:border-primary/50 hover:bg-primary/5"
              data-testid="button-video"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary/10 to-purple-600/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 bg-primary/20 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Create Video</h3>
                <p className="text-xs text-muted-foreground">Sync visuals with music</p>
              </div>
            </Button>
          </div>

        </div>
      </main>

      {/* Right Sidebar - History */}
      <GenerationHistory 
        onSelectMusic={handleSelectMusic}
        onSelectImage={handleSelectImage}
      />

      {/* Floating Action Button for Quick Generate */}
      <Button
        onClick={handleQuickGenerate}
        disabled={isGenerating}
        size="lg"
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-primary to-purple-600 shadow-2xl hover:scale-110 disabled:scale-100 transition-transform z-50"
        data-testid="button-quick-generate"
      >
        {isGenerating ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
