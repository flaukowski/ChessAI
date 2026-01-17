/**
 * AudioNoise Web Studio
 * Real-time DSP effects processing workspace with pedalboard-style effect chain
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Home, LogOut, Bluetooth, Waves, ChevronLeft, Download, FileAudio, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

import { AudioInput } from '@/components/audio-input';
import { AudioVisualizer } from '@/components/audio-visualizer';
import { Pedalboard } from '@/components/pedalboard';
import { AIEffectSuggester, type EffectType } from '@/components/ai-effect-suggester';
import { BluetoothDevicePanel } from '@/components/bluetooth-device-panel';
import { AudioRoutingMatrix } from '@/components/audio-routing-matrix';
import { MobileNav, MobileHeader } from '@/components/mobile-nav';

import { usePedalboard, type WorkletEffectType } from '@/hooks/use-pedalboard';
import { useBluetoothAudio } from '@/hooks/use-bluetooth-audio';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { decodePresetFromUrl, initializeDefaultPresets } from '@/lib/preset-manager';
import {
  exportAudio,
  loadAudioFile,
  downloadAudio,
  isFormatSupported,
  FORMAT_INFO,
  type ExportProgress,
  type AudioFormat,
  type ExportOptions,
} from '@/lib/dsp/audio-export';

import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

export default function Studio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, isAuthenticated, logout } = useSpaceChildAuth();
  const isMobile = useIsMobile();

  const [activeView, setActiveView] = useState<'dsp' | 'routing'>('dsp');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<AudioFormat>('wav');
  const [exportBitrate, setExportBitrate] = useState<128 | 192 | 256 | 320>(192);
  const [exportBitDepth, setExportBitDepth] = useState<16 | 24 | 32>(16);
  const [exportNormalize, setExportNormalize] = useState(true);

  const audioFileRef = useRef<File | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const {
    isInitialized,
    inputGain,
    outputGain,
    globalBypass,
    effects,
    inputSource,
    levels,
    initialize: initializeAudio,
    connectAudioFile,
    connectMicrophone,
    disconnectMicrophone,
    addEffect,
    removeEffect,
    reorderEffects,
    toggleEffect,
    updateEffectParam,
    setInputGain,
    setOutputGain,
    setGlobalBypass,
    getFrequencyData,
    getTimeDomainData,
    exportPreset,
    importPreset,
    analyser,
    audioContext,
  } = usePedalboard();

  // Initialize default presets on first load
  useEffect(() => {
    initializeDefaultPresets();
  }, []);

  // Check for preset in URL on load
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const presetParam = params.get('preset');
    if (presetParam) {
      const preset = decodePresetFromUrl(presetParam);
      if (preset) {
        // Build preset JSON for import
        const presetJson = JSON.stringify({
          version: 1,
          inputGain: preset.inputGain,
          outputGain: preset.outputGain,
          effects: preset.effects,
        });
        // Delay import to ensure audio is initialized
        setTimeout(() => {
          importPreset(presetJson);
        }, 500);
      }
    }
  }, [searchString, importPreset]);

  // Handle file loaded for export
  const handleAudioFileLoaded = useCallback(async (file: File) => {
    audioFileRef.current = file;
    try {
      audioBufferRef.current = await loadAudioFile(file);
    } catch (error) {
      console.error('Failed to load audio buffer:', error);
    }
  }, []);

  // Audio Export handler (supports multiple formats)
  const handleExport = useCallback(async () => {
    if (!audioBufferRef.current || effects.length === 0) {
      return;
    }

    setIsExporting(true);
    setExportProgress({ phase: 'preparing', progress: 0 });

    try {
      const effectsForExport = effects.map((e) => ({
        type: e.type,
        enabled: e.enabled,
        params: e.params,
      }));

      const exportOptions: ExportOptions = {
        format: exportFormat,
        normalize: exportNormalize,
        bitDepth: exportBitDepth,
        bitrate: exportBitrate,
      };

      const audioBlob = await exportAudio(
        audioBufferRef.current,
        effectsForExport,
        inputGain,
        outputGain,
        exportOptions,
        setExportProgress
      );

      const filename = audioFileRef.current?.name?.replace(/\.[^/.]+$/, '') || 'processed';
      downloadAudio(audioBlob, `${filename}-processed`, exportFormat);

      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [effects, inputGain, outputGain, exportFormat, exportNormalize, exportBitDepth, exportBitrate]);

  // AI suggestion handlers - map old effect types to new ones
  const handleAISuggestion = useCallback((type: EffectType, params: Record<string, number>) => {
    // Map old types to new worklet types
    const typeMap: Record<string, WorkletEffectType> = {
      'echo': 'delay',
      'flanger': 'chorus',
      'phaser': 'chorus',
      'lowpass': 'eq',
      'highpass': 'eq',
      'bandpass': 'eq',
      'notch': 'eq',
      'eq': 'eq',
      'distortion': 'distortion',
      'delay': 'delay',
      'chorus': 'chorus',
      'compressor': 'compressor',
    };

    const newType = typeMap[type] || 'eq';
    const id = addEffect(newType);

    // Apply params
    if (id) {
      Object.entries(params).forEach(([param, value]) => {
        updateEffectParam(id, param, value);
      });
    }
  }, [addEffect, updateEffectParam]);

  const handleAIChainSuggestion = useCallback((suggestions: Array<{ type: EffectType; params: Record<string, number> }>) => {
    suggestions.forEach((suggestion) => {
      handleAISuggestion(suggestion.type, suggestion.params);
    });
  }, [handleAISuggestion]);

  const {
    devices,
    inputChannels,
    outputChannels,
    routingMatrix,
    bandwidthWarning,
    isScanning,
    channelLevels,
    initialize: initializeBluetooth,
    scanDevices,
    createInputChannel,
    createOutputChannel,
    removeChannel,
    setChannelMute,
    setRouting,
    toggleRouting,
    updateRoutingGain,
    setChannelVolume,
    setChannelPan,
  } = useBluetoothAudio();

  useEffect(() => {
    initializeAudio();
    initializeBluetooth();
  }, [initializeAudio, initializeBluetooth]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const handleHomeClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const renderDSPView = () => (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Input and Visualizer Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1">
          <AudioInput
            onAudioElementReady={connectAudioFile}
            onMicrophoneConnect={connectMicrophone}
            onMicrophoneDisconnect={disconnectMicrophone}
            onFileLoaded={handleAudioFileLoaded}
            inputSource={inputSource}
            volume={inputGain}
            onVolumeChange={setInputGain}
            className="h-full"
          />
        </div>

        <div className="lg:col-span-2">
          <AudioVisualizer
            analyser={analyser}
            isPlaying={inputSource !== null}
            className="h-[200px] lg:h-full"
          />
        </div>
      </div>

      {/* Pedalboard */}
      <Pedalboard
        effects={effects}
        inputGain={inputGain}
        outputGain={outputGain}
        globalBypass={globalBypass}
        levels={levels}
        onAddEffect={addEffect}
        onRemoveEffect={removeEffect}
        onReorderEffects={reorderEffects}
        onToggleEffect={toggleEffect}
        onUpdateParam={updateEffectParam}
        onSetInputGain={setInputGain}
        onSetOutputGain={setOutputGain}
        onSetGlobalBypass={setGlobalBypass}
        onExportPreset={exportPreset}
        onImportPreset={importPreset}
      />

      {/* AI Effect Suggester */}
      <AIEffectSuggester
        analyser={analyser}
        onApplySuggestion={handleAISuggestion}
        onApplyChain={handleAIChainSuggestion}
        currentGenre="guitar-clean"
      />

      {/* Export Button */}
      {inputSource === 'file' && audioBufferRef.current && (
        <Button
          onClick={() => setExportDialogOpen(true)}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600"
          size="lg"
        >
          <Download className="w-5 h-5 mr-2" />
          Export Processed Audio
        </Button>
      )}

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileAudio className="w-5 h-5" />
              Export Processed Audio
            </DialogTitle>
            <DialogDescription>
              Choose a format and render your audio with the current effect chain
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-sm">
              <p className="text-muted-foreground">File: <span className="text-foreground">{audioFileRef.current?.name || 'Unknown'}</span></p>
              <p className="text-muted-foreground">Effects: <span className="text-foreground">{effects.filter(e => e.enabled).length} active</span></p>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(['wav', 'mp3', 'ogg'] as AudioFormat[]).map((format) => {
                  const info = FORMAT_INFO[format];
                  const supported = isFormatSupported(format);
                  return (
                    <button
                      key={format}
                      onClick={() => supported && setExportFormat(format)}
                      disabled={!supported || isExporting}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        exportFormat === format
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-muted-foreground/50'
                      } ${!supported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-medium text-sm">{info.name}</div>
                      <div className="text-xs text-muted-foreground">.{info.extension}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{FORMAT_INFO[exportFormat].description}</p>
            </div>

            {/* Format-specific options */}
            {exportFormat === 'wav' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bit Depth</label>
                <div className="grid grid-cols-3 gap-2">
                  {([16, 24, 32] as const).map((depth) => (
                    <button
                      key={depth}
                      onClick={() => setExportBitDepth(depth)}
                      disabled={isExporting}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        exportBitDepth === depth
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      {depth}-bit {depth === 32 ? '(float)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exportFormat === 'mp3' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bitrate</label>
                <div className="grid grid-cols-4 gap-2">
                  {([128, 192, 256, 320] as const).map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setExportBitrate(rate)}
                      disabled={isExporting}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        exportBitrate === rate
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      {rate}kbps
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Normalize option */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Normalize Audio</label>
                <p className="text-xs text-muted-foreground">Adjust peak level to -1dB</p>
              </div>
              <button
                onClick={() => setExportNormalize(!exportNormalize)}
                disabled={isExporting}
                className={`w-12 h-6 rounded-full transition-colors ${
                  exportNormalize ? 'bg-green-500' : 'bg-muted'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    exportNormalize ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {exportProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{exportProgress.phase}...</span>
                  <span>{Math.round(exportProgress.progress * 100)}%</span>
                </div>
                <Progress value={exportProgress.progress * 100} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting} className="bg-gradient-to-r from-green-500 to-emerald-600">
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export {FORMAT_INFO[exportFormat].name}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderRoutingView = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
      <BluetoothDevicePanel
        devices={devices}
        inputChannels={inputChannels}
        outputChannels={outputChannels}
        isScanning={isScanning}
        bandwidthWarning={bandwidthWarning}
        onScanDevices={scanDevices}
        onCreateInputChannel={createInputChannel}
        onCreateOutputChannel={createOutputChannel}
        onRemoveChannel={removeChannel}
        onSetChannelMute={setChannelMute}
      />
      
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
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <MobileHeader
          title="AudioNoise"
          onHomeClick={handleHomeClick}
          onMenuClick={() => setMenuOpen(true)}
        />

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="right" className="w-[280px]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-2 mt-6">
              {isAuthenticated && user && (
                <div className="p-4 bg-muted rounded-lg mb-4">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-medium truncate">{user.firstName || user.email}</p>
                </div>
              )}
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => { handleHomeClick(); setMenuOpen(false); }}
                data-testid="button-mobile-home"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  className="justify-start text-destructive"
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  data-testid="button-mobile-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <main className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: activeView === 'dsp' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeView === 'dsp' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dsp' ? renderDSPView() : renderRoutingView()}
            </motion.div>
          </AnimatePresence>
        </main>

        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHomeClick}
              data-testid="button-home"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                AudioNoise Studio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user && (
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.firstName || user.email}
              </span>
            )}
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <Tabs defaultValue="dsp" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dsp" className="flex items-center gap-2" data-testid="tab-dsp">
              <Waves className="w-4 h-4" />
              DSP Effects
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2" data-testid="tab-routing">
              <Bluetooth className="w-4 h-4" />
              Audio Routing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dsp" className="space-y-6">
            {renderDSPView()}
          </TabsContent>

          <TabsContent value="routing" className="space-y-6">
            {renderRoutingView()}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
