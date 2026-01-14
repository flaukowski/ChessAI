import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu, Home, Upload, User, Plus, Waves, Sparkles, Music, Bluetooth, GitBranch, X } from "lucide-react";
import { PromptSidebar, type GenerationParams } from "@/components/prompt-sidebar";
import { AudioPlayer } from "@/components/audio-player";
import { ImageGallery } from "@/components/image-gallery";
import { GenerationHistory } from "@/components/generation-history";
import { EffectsRack } from "@/components/effects-rack";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { AIEffectSuggester } from "@/components/ai-effect-suggester";
import { AudioInput } from "@/components/audio-input";
import { useAudioDSP } from "@/hooks/use-audio-dsp";
import { useBluetoothAudio } from "@/hooks/use-bluetooth-audio";
import { useIsMobile } from "@/hooks/use-mobile";
import { BluetoothDevicePanel } from "@/components/bluetooth-device-panel";
import { AudioRoutingMatrix } from "@/components/audio-routing-matrix";
import { MobileNav, MobileHeader } from "@/components/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import type { MusicGeneration, ImageGeneration } from "@shared/schema";

export default function Studio() {
  const [currentMusic, setCurrentMusic] = useState<MusicGeneration | null>(null);
  const [images, setImages] = useState<ImageGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState<'generate' | 'dsp' | 'routing'>('generate');
  const [currentGenre, setCurrentGenre] = useState('indie-pop');
  const [promptOpen, setPromptOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  
  // DSP Hook for real-time audio processing
  const {
    isInitialized: dspInitialized,
    inputSource,
    volume,
    effects,
    analyser,
    initialize: initializeDSP,
    connectAudioFile,
    connectMicrophone,
    disconnectMicrophone,
    addEffect,
    setVolume,
  } = useAudioDSP();

  // Multi-channel Bluetooth Audio Hook
  const {
    isInitialized: btInitialized,
    devices,
    inputChannels,
    outputChannels,
    routingMatrix,
    channelLevels,
    bandwidthWarning,
    isScanning,
    initialize: initializeBluetooth,
    scanDevices,
    createInputChannel,
    createOutputChannel,
    removeChannel,
    setRouting,
    toggleRouting,
    updateRoutingGain,
    setChannelVolume,
    setChannelPan,
    setChannelMute,
    startLevelMetering,
    stopLevelMetering,
  } = useBluetoothAudio();

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
      
      {/* Mobile Prompt Sheet */}
      {isMobile && (
        <Sheet open={promptOpen} onOpenChange={setPromptOpen}>
          <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-hidden">
            <PromptSidebar 
              onGenerate={(params) => {
                handleGenerate(params);
                setPromptOpen(false);
              }} 
              isGenerating={isGenerating}
              className="border-0 w-full h-full"
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile History Sheet */}
      {isMobile && (
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-hidden">
            <GenerationHistory 
              onSelectMusic={(gen) => {
                handleSelectMusic(gen);
                setHistoryOpen(false);
              }}
              onSelectImage={(gen) => {
                handleSelectImage(gen);
                setHistoryOpen(false);
              }}
              className="border-0 w-full h-full"
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Left Sidebar - Prompt & Controls */}
      {!isMobile && (
        <PromptSidebar 
          onGenerate={handleGenerate} 
          isGenerating={isGenerating}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Mobile Header */}
        {isMobile ? (
          <MobileHeader 
            title="SonicVision" 
            onHomeClick={() => navigate('/')}
          />
        ) : (
          /* Desktop Top Navigation Bar */
          <header className="h-14 border-b border-border px-4 md:px-6 flex items-center justify-between bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setPromptOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="w-4 h-4" />
                <span>/</span>
                <span className="text-foreground font-medium">Studio</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden sm:flex" data-testid="button-export">
                <Upload className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                size="icon" 
                className="w-9 h-9 rounded-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                data-testid="button-user"
              >
                <User className="w-4 h-4" />
              </Button>
            </div>
          </header>
        )}

        {/* Content Container with View Tabs */}
        <Tabs 
          value={activeView} 
          onValueChange={(v) => setActiveView(v as 'generate' | 'dsp' | 'routing')} 
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Desktop Tab List - hidden on mobile (bottom nav used instead) */}
          {!isMobile && (
            <div className="px-4 md:px-6 pt-3 border-b border-border">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="generate" className="gap-2 text-xs sm:text-sm">
                  <Music className="w-4 h-4" />
                  <span className="hidden sm:inline">AI Generate</span>
                  <span className="sm:hidden">Create</span>
                </TabsTrigger>
                <TabsTrigger value="dsp" className="gap-2 text-xs sm:text-sm">
                  <Waves className="w-4 h-4" />
                  <span className="hidden sm:inline">DSP Effects</span>
                  <span className="sm:hidden">FX</span>
                </TabsTrigger>
                <TabsTrigger value="routing" className="gap-2 text-xs sm:text-sm">
                  <Bluetooth className="w-4 h-4" />
                  <span className="hidden sm:inline">Multi-Channel</span>
                  <span className="sm:hidden">Route</span>
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          {/* AI Generation View */}
          <TabsContent value="generate" className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 m-0 ${isMobile ? 'pb-24' : ''}`}>
            {/* Audio Player Section */}
            <AudioPlayer 
              musicGeneration={currentMusic}
              className="hover:shadow-xl transition-shadow" 
            />

            {currentMusic && currentMusic.status !== "completed" && currentMusic.status !== "failed" && (
              <div className="p-3 md:p-4 rounded-lg border border-border bg-card">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Generating music…</span>
                  <span>{Math.max(0, Math.min(100, currentMusic.progress || 0))}%</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, currentMusic.progress || 0))} />
                {currentMusic.statusDetail && (
                  <div className="mt-2 text-xs text-muted-foreground">{currentMusic.statusDetail}</div>
                )}
              </div>
            )}

            {/* Image Gallery Section */}
            <ImageGallery 
              images={images}
              className="hover:shadow-xl transition-shadow"
            />

            {/* Quick Actions - responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <Button 
                variant="outline" 
                className="p-3 md:p-4 h-auto text-left group hover:border-primary/50 hover:bg-primary/5 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0"
                data-testid="button-remix"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-r from-primary/10 to-purple-600/10 flex items-center justify-center sm:mb-3 group-hover:scale-110 transition-transform flex-shrink-0">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-primary/20 rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">Remix Track</h3>
                  <p className="text-xs text-muted-foreground">Create variations of your song</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="p-3 md:p-4 h-auto text-left group hover:border-accent/50 hover:bg-accent/5 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0"
                onClick={() => setActiveView('dsp')}
                data-testid="button-dsp"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-600/10 flex items-center justify-center sm:mb-3 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Waves className="w-5 h-5 md:w-6 md:h-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">DSP Effects</h3>
                  <p className="text-xs text-muted-foreground">Real-time audio processing</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="p-3 md:p-4 h-auto text-left group hover:border-primary/50 hover:bg-primary/5 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0"
                data-testid="button-video"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-r from-primary/10 to-purple-600/10 flex items-center justify-center sm:mb-3 group-hover:scale-110 transition-transform flex-shrink-0">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-primary/20 rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">Create Video</h3>
                  <p className="text-xs text-muted-foreground">Sync visuals with music</p>
                </div>
              </Button>
            </div>
          </TabsContent>

          {/* DSP Effects View */}
          <TabsContent value="dsp" className={`flex-1 overflow-y-auto p-4 md:p-6 m-0 ${isMobile ? 'pb-24' : ''}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Left Column - Input & Visualizer */}
              <div className="space-y-4">
                <AudioInput
                  onAudioElementReady={connectAudioFile}
                  onMicrophoneConnect={connectMicrophone}
                  onMicrophoneDisconnect={disconnectMicrophone}
                  inputSource={inputSource}
                  volume={volume}
                  onVolumeChange={setVolume}
                />
                
                <AudioVisualizer
                  analyser={analyser}
                  isPlaying={inputSource !== null}
                />

                <AIEffectSuggester
                  analyser={analyser}
                  currentGenre={currentGenre}
                  onApplySuggestion={(type, params) => {
                    addEffect(type);
                  }}
                />
              </div>

              {/* Right Column - Effects Rack */}
              <div>
                <EffectsRack />
              </div>
            </div>

            {/* DSP Info Banner */}
            <div className="mt-4 md:mt-6 p-3 md:p-4 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">AudioNoise DSP Engine</h3>
                  <p className="text-xs text-muted-foreground">
                    Real-time audio processing powered by algorithms ported from C-based guitar pedal effects. 
                    Features biquad filters, echo, flanger, phaser, and LFO modulation.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Multi-Channel Routing View */}
          <TabsContent value="routing" className={`flex-1 overflow-y-auto p-4 md:p-6 m-0 ${isMobile ? 'pb-24' : ''}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Left Column - Device Panel */}
              <div className="lg:col-span-1">
                <BluetoothDevicePanel
                  devices={devices}
                  inputChannels={inputChannels}
                  outputChannels={outputChannels}
                  isScanning={isScanning}
                  bandwidthWarning={bandwidthWarning}
                  onScanDevices={async () => {
                    if (!btInitialized) {
                      await initializeBluetooth();
                      startLevelMetering();
                    }
                    await scanDevices();
                  }}
                  onCreateInputChannel={createInputChannel}
                  onCreateOutputChannel={createOutputChannel}
                  onRemoveChannel={removeChannel}
                  onSetChannelMute={setChannelMute}
                />
              </div>

              {/* Right Column - Routing Matrix */}
              <div className="lg:col-span-2">
                <AudioRoutingMatrix
                  inputChannels={inputChannels}
                  outputChannels={outputChannels}
                  routingMatrix={routingMatrix}
                  channelLevels={channelLevels}
                  onSetRouting={setRouting}
                  onToggleRouting={toggleRouting}
                  onUpdateRoutingGain={updateRoutingGain}
                  onSetChannelVolume={setChannelVolume}
                  onSetChannelPan={setChannelPan}
                />
              </div>
            </div>

            {/* Multi-Channel Info Banner */}
            <div className="mt-4 md:mt-6 p-3 md:p-4 rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-violet-500/5">
              <div className="flex items-start gap-3">
                <GitBranch className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Multi-Channel Bluetooth Audio</h3>
                  <p className="text-xs text-muted-foreground">
                    Connect multiple Bluetooth instruments simultaneously with intelligent bandwidth management.
                    Route any input to any output with independent volume and pan controls.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Desktop Right Sidebar - History */}
      {!isMobile && (
        <GenerationHistory 
          onSelectMusic={handleSelectMusic}
          onSelectImage={handleSelectImage}
        />
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNav 
          activeView={activeView}
          onViewChange={setActiveView}
          onOpenPrompt={() => setPromptOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          isGenerating={isGenerating}
        />
      )}

      {/* Desktop Floating Action Button for Quick Generate */}
      {!isMobile && (
        <Button
          onClick={handleQuickGenerate}
          disabled={isGenerating}
          size="lg"
          className="fixed bottom-8 right-8 w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-primary to-purple-600 shadow-2xl hover:scale-110 disabled:scale-100 transition-transform z-50"
          data-testid="button-quick-generate"
        >
          {isGenerating ? (
            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
          )}
        </Button>
      )}
    </div>
  );
}
