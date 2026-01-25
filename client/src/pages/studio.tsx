/**
 * AudioNoise Web Studio
 * Real-time DSP effects processing workspace with pedalboard-style effect chain
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Home, LogOut, Headphones, Waves, ChevronLeft, Download, FileAudio, Loader2, Music, Users, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { AudioInput, type AudioInputRef } from '@/components/audio-input';
import { AudioVisualizer } from '@/components/audio-visualizer';
import { Pedalboard } from '@/components/pedalboard';
import { AIEffectSuggester, type EffectType } from '@/components/ai-effect-suggester';
import { AIEffectChat, type EffectSuggestion } from '@/components/ai-effect-chat';
import { AudioAdapterPanel } from '@/components/audio-adapter-panel';
import { AudioRoutingMatrix } from '@/components/audio-routing-matrix';
import { MobileNav, MobileHeader } from '@/components/mobile-nav';
import { RecordingControls } from '@/components/recording-controls';
import { RecordingsLibrary } from '@/components/recordings-library';
import { CommunityRecordings } from '@/components/community-recordings';

import { usePedalboard, type WorkletEffectType } from '@/hooks/use-pedalboard';
import { useAudioAdapter } from '@/hooks/use-audio-adapter';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { decodePresetFromUrl, initializeDefaultPresets, savePreset } from '@/lib/preset-manager';
import { useToast } from '@/hooks/use-toast';
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
  const { user, isAuthenticated, isLoading: authLoading, logout } = useSpaceChildAuth();
  const isMobile = useIsMobile();

  const [activeView, setActiveView] = useState<'dsp' | 'routing' | 'recordings'>('dsp');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<AudioFormat>('wav');
  const [exportBitrate, setExportBitrate] = useState<128 | 192 | 256 | 320>(192);
  const [exportBitDepth, setExportBitDepth] = useState<16 | 24 | 32>(16);
  const [exportNormalize, setExportNormalize] = useState(true);
  const [pendingRecording, setPendingRecording] = useState<{url: string, title: string} | null>(null);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [selectedEffectIndex, setSelectedEffectIndex] = useState<number>(-1);
  const [clipboardEffect, setClipboardEffect] = useState<{ type: WorkletEffectType; params: Record<string, number> } | null>(null);

  const audioFileRef = useRef<File | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioInputRef = useRef<AudioInputRef>(null);

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
    outputNode,
  } = usePedalboard();

  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const { toast } = useToast();
  const undoRedo = useUndoRedo();

  // Wrapped pedalboard actions that record undo/redo history
  const handleAddEffect = useCallback((type: WorkletEffectType) => {
    const id = addEffect(type);
    undoRedo.recordEffectAdd(type);
    return id;
  }, [addEffect, undoRedo]);

  const handleRemoveEffect = useCallback((id: string) => {
    const effect = effects.find(e => e.id === id);
    removeEffect(id);
    if (effect) {
      undoRedo.recordEffectRemove(effect.type);
    }
  }, [effects, removeEffect, undoRedo]);

  const handleReorderEffects = useCallback((newOrder: string[]) => {
    reorderEffects(newOrder);
    undoRedo.recordEffectReorder();
  }, [reorderEffects, undoRedo]);

  const handleToggleEffect = useCallback((id: string) => {
    const effect = effects.find(e => e.id === id);
    toggleEffect(id);
    if (effect) {
      undoRedo.recordEffectToggle(effect.type, !effect.enabled);
    }
  }, [effects, toggleEffect, undoRedo]);

  const handleUpdateParam = useCallback((id: string, param: string, value: number) => {
    const effect = effects.find(e => e.id === id);
    updateEffectParam(id, param, value);
    if (effect) {
      undoRedo.recordParamChange(effect.type, param);
    }
  }, [effects, updateEffectParam, undoRedo]);

  const handleSetInputGain = useCallback((gain: number) => {
    setInputGain(gain);
    undoRedo.recordGainChange('input');
  }, [setInputGain, undoRedo]);

  const handleSetOutputGain = useCallback((gain: number) => {
    setOutputGain(gain);
    undoRedo.recordGainChange('output');
  }, [setOutputGain, undoRedo]);

  const handleSetGlobalBypass = useCallback((bypass: boolean) => {
    setGlobalBypass(bypass);
    undoRedo.recordBypassChange(bypass);
  }, [setGlobalBypass, undoRedo]);

  const handleImportPreset = useCallback((json: string) => {
    importPreset(json);
    undoRedo.recordPresetLoad();
  }, [importPreset, undoRedo]);

  // Get the audio element ref for playback control
  const getAudioElement = useCallback((): HTMLAudioElement | null => {
    // Find the audio element in the AudioInput component
    const audioEl = document.querySelector('audio');
    return audioEl as HTMLAudioElement | null;
  }, []);

  // Keyboard shortcut handlers
  const handleTogglePlayback = useCallback(() => {
    const audio = getAudioElement();
    if (audio) {
      if (audio.paused) {
        audio.play().catch(console.error);
        toast({ title: 'Playing', description: 'Audio playback started', duration: 1500 });
      } else {
        audio.pause();
        toast({ title: 'Paused', description: 'Audio playback paused', duration: 1500 });
      }
    } else if (inputSource === 'microphone') {
      // Toggle global bypass for microphone input
      handleSetGlobalBypass(!globalBypass);
      toast({
        title: globalBypass ? 'Effects Active' : 'Effects Bypassed',
        description: globalBypass ? 'Audio effects are now active' : 'Audio effects are bypassed',
        duration: 1500
      });
    }
  }, [getAudioElement, inputSource, globalBypass, handleSetGlobalBypass, toast]);

  const handleBypassSelected = useCallback(() => {
    if (selectedEffectIndex >= 0 && selectedEffectIndex < effects.length) {
      const effect = effects[selectedEffectIndex];
      handleToggleEffect(effect.id);
      toast({
        title: effect.enabled ? 'Effect Bypassed' : 'Effect Enabled',
        description: `${effect.type} is now ${effect.enabled ? 'bypassed' : 'enabled'}`,
        duration: 1500
      });
    } else {
      // Toggle global bypass if no effect selected
      handleSetGlobalBypass(!globalBypass);
      toast({
        title: globalBypass ? 'Effects Active' : 'Effects Bypassed',
        description: globalBypass ? 'All effects enabled' : 'All effects bypassed',
        duration: 1500
      });
    }
  }, [selectedEffectIndex, effects, handleToggleEffect, globalBypass, handleSetGlobalBypass, toast]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedEffectIndex >= 0 && selectedEffectIndex < effects.length) {
      const effect = effects[selectedEffectIndex];
      handleRemoveEffect(effect.id);
      toast({ title: 'Effect Removed', description: `${effect.type} has been removed`, duration: 1500 });
      // Adjust selection
      if (selectedEffectIndex >= effects.length - 1) {
        setSelectedEffectIndex(Math.max(0, effects.length - 2));
      }
    }
  }, [selectedEffectIndex, effects, handleRemoveEffect, toast]);

  const handleCopyEffect = useCallback(() => {
    if (selectedEffectIndex >= 0 && selectedEffectIndex < effects.length) {
      const effect = effects[selectedEffectIndex];
      setClipboardEffect({ type: effect.type, params: { ...effect.params } });
      toast({ title: 'Effect Copied', description: `${effect.type} copied to clipboard`, duration: 1500 });
    }
  }, [selectedEffectIndex, effects, toast]);

  const handlePasteEffect = useCallback(() => {
    if (clipboardEffect) {
      const id = handleAddEffect(clipboardEffect.type);
      if (id) {
        Object.entries(clipboardEffect.params).forEach(([param, value]) => {
          handleUpdateParam(id, param, value);
        });
        toast({ title: 'Effect Pasted', description: `${clipboardEffect.type} added to chain`, duration: 1500 });
        setSelectedEffectIndex(effects.length); // Select the new effect
      }
    }
  }, [clipboardEffect, handleAddEffect, handleUpdateParam, effects.length, toast]);

  const handleDuplicateEffect = useCallback(() => {
    if (selectedEffectIndex >= 0 && selectedEffectIndex < effects.length) {
      const effect = effects[selectedEffectIndex];
      const id = handleAddEffect(effect.type);
      if (id) {
        Object.entries(effect.params).forEach(([param, value]) => {
          handleUpdateParam(id, param, value);
        });
        toast({ title: 'Effect Duplicated', description: `${effect.type} duplicated`, duration: 1500 });
        setSelectedEffectIndex(effects.length); // Select the new effect
      }
    }
  }, [selectedEffectIndex, effects, handleAddEffect, handleUpdateParam, toast]);

  const handleSavePreset = useCallback(() => {
    const presetName = `Preset ${new Date().toLocaleString()}`;
    savePreset({
      name: presetName,
      inputGain,
      outputGain,
      effects: effects.map(e => ({
        type: e.type,
        enabled: e.enabled,
        params: e.params,
      })),
    });
    toast({ title: 'Preset Saved', description: `Saved as "${presetName}"`, duration: 2000 });
  }, [inputGain, outputGain, effects, toast]);

  const handleSelectEffectByNumber = useCallback((num: number) => {
    const index = num - 1;
    if (index >= 0 && index < effects.length) {
      setSelectedEffectIndex(index);
      toast({ title: 'Effect Selected', description: `Selected ${effects[index].type}`, duration: 1000 });
    }
  }, [effects, toast]);

  const handleNavigateUp = useCallback(() => {
    if (effects.length > 0) {
      const newIndex = selectedEffectIndex <= 0 ? effects.length - 1 : selectedEffectIndex - 1;
      setSelectedEffectIndex(newIndex);
    }
  }, [effects.length, selectedEffectIndex]);

  const handleNavigateDown = useCallback(() => {
    if (effects.length > 0) {
      const newIndex = selectedEffectIndex >= effects.length - 1 ? 0 : selectedEffectIndex + 1;
      setSelectedEffectIndex(newIndex);
    }
  }, [effects.length, selectedEffectIndex]);

  const handleDeselect = useCallback(() => {
    setSelectedEffectIndex(-1);
    toast({ title: 'Deselected', description: 'All effects deselected', duration: 1000 });
  }, [toast]);

  const handleShowShortcuts = useCallback(() => {
    setShortcutsDialogOpen(prev => !prev);
  }, []);

  // Register keyboard shortcuts
  useEffect(() => {
    // Playback shortcuts
    registerShortcut({
      key: ' ',
      description: 'Toggle playback / bypass',
      category: 'playback',
      action: handleTogglePlayback,
    });

    // Effect shortcuts
    registerShortcut({
      key: 'b',
      description: 'Bypass selected effect',
      category: 'effects',
      action: handleBypassSelected,
    });

    registerShortcut({
      key: 'Delete',
      description: 'Remove selected effect',
      category: 'effects',
      action: handleDeleteSelected,
    });

    registerShortcut({
      key: 'Backspace',
      description: 'Remove selected effect',
      category: 'effects',
      action: handleDeleteSelected,
    });

    registerShortcut({
      key: 'c',
      ctrl: true,
      description: 'Copy selected effect',
      category: 'effects',
      action: handleCopyEffect,
    });

    registerShortcut({
      key: 'c',
      meta: true,
      description: 'Copy selected effect',
      category: 'effects',
      action: handleCopyEffect,
    });

    registerShortcut({
      key: 'v',
      ctrl: true,
      description: 'Paste effect',
      category: 'effects',
      action: handlePasteEffect,
    });

    registerShortcut({
      key: 'v',
      meta: true,
      description: 'Paste effect',
      category: 'effects',
      action: handlePasteEffect,
    });

    registerShortcut({
      key: 'd',
      ctrl: true,
      description: 'Duplicate selected effect',
      category: 'effects',
      action: handleDuplicateEffect,
    });

    registerShortcut({
      key: 'd',
      meta: true,
      description: 'Duplicate selected effect',
      category: 'effects',
      action: handleDuplicateEffect,
    });

    registerShortcut({
      key: 's',
      ctrl: true,
      description: 'Save preset',
      category: 'general',
      action: handleSavePreset,
    });

    registerShortcut({
      key: 's',
      meta: true,
      description: 'Save preset',
      category: 'general',
      action: handleSavePreset,
    });

    // Navigation shortcuts
    registerShortcut({
      key: 'ArrowUp',
      description: 'Select previous effect',
      category: 'navigation',
      action: handleNavigateUp,
    });

    registerShortcut({
      key: 'ArrowDown',
      description: 'Select next effect',
      category: 'navigation',
      action: handleNavigateDown,
    });

    registerShortcut({
      key: 'Escape',
      description: 'Deselect all',
      category: 'navigation',
      action: handleDeselect,
    });

    // Quick select (1-9)
    for (let i = 1; i <= 9; i++) {
      registerShortcut({
        key: String(i),
        description: `Select effect ${i}`,
        category: 'navigation',
        action: () => handleSelectEffectByNumber(i),
      });
    }

    // Help shortcut
    registerShortcut({
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'general',
      action: handleShowShortcuts,
    });

    return () => {
      // Cleanup shortcuts on unmount
      unregisterShortcut(' ');
      unregisterShortcut('b');
      unregisterShortcut('Delete');
      unregisterShortcut('Backspace');
      unregisterShortcut('c');
      unregisterShortcut('v');
      unregisterShortcut('d');
      unregisterShortcut('s');
      unregisterShortcut('ArrowUp');
      unregisterShortcut('ArrowDown');
      unregisterShortcut('Escape');
      unregisterShortcut('?');
      for (let i = 1; i <= 9; i++) {
        unregisterShortcut(String(i));
      }
    };
  }, [
    registerShortcut,
    unregisterShortcut,
    handleTogglePlayback,
    handleBypassSelected,
    handleDeleteSelected,
    handleCopyEffect,
    handlePasteEffect,
    handleDuplicateEffect,
    handleSavePreset,
    handleNavigateUp,
    handleNavigateDown,
    handleDeselect,
    handleSelectEffectByNumber,
    handleShowShortcuts,
  ]);

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
          handleImportPreset(presetJson);
        }, 500);
      }
    }
  }, [searchString, handleImportPreset]);

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
    const id = handleAddEffect(newType);

    // Apply params
    if (id) {
      Object.entries(params).forEach(([param, value]) => {
        handleUpdateParam(id, param, value);
      });
    }
  }, [handleAddEffect, handleUpdateParam]);

  const handleAIChainSuggestion = useCallback((suggestions: Array<{ type: EffectType; params: Record<string, number> }>) => {
    suggestions.forEach((suggestion) => {
      handleAISuggestion(suggestion.type, suggestion.params);
    });
  }, [handleAISuggestion]);

  const handleAIChatSuggestion = useCallback((type: string, params: Record<string, number>) => {
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
      'reverb': 'reverb',
      'basspurr': 'basspurr',
      'tremolo': 'tremolo',
    };

    // Normalize the type to lowercase for matching
    const normalizedType = type.toLowerCase().trim();
    const newType = typeMap[normalizedType] || 'eq';
    console.log(`[AI Effect] Applying effect: ${type} -> ${normalizedType} -> ${newType}`);
    const id = handleAddEffect(newType);

    if (id) {
      Object.entries(params).forEach(([param, value]) => {
        handleUpdateParam(id, param, value);
      });
    }
  }, [handleAddEffect, handleUpdateParam]);

  const handleAIChatChainSuggestion = useCallback((suggestions: EffectSuggestion[]) => {
    suggestions.forEach((suggestion) => {
      handleAIChatSuggestion(suggestion.type, suggestion.params);
    });
  }, [handleAIChatSuggestion]);

  // Handler for loading recordings from the library
  const handleLoadRecording = useCallback((recordingUrl: string, title: string) => {
    // Set pending recording and switch to DSP view
    // The useEffect below will handle loading when the ref is available
    setPendingRecording({ url: recordingUrl, title });
    setActiveView('dsp');
  }, []);

  // Effect to load pending recording when DSP view is active and ref is available
  useEffect(() => {
    if (pendingRecording && activeView === 'dsp' && audioInputRef.current) {
      const { url, title } = pendingRecording;
      setPendingRecording(null); // Clear immediately to prevent re-triggering
      audioInputRef.current.loadFromUrl(url, title).catch(error => {
        console.error('Failed to load recording:', error);
      });
    }
  }, [pendingRecording, activeView]);

  const {
    devices,
    inputChannels,
    outputChannels,
    routingMatrix,
    bandwidthWarning,
    latencyWarning,
    isScanning,
    channelLevels,
    initialize: initializeAudioAdapter,
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
    applyPreset,
    getPresets,
  } = useAudioAdapter();

  useEffect(() => {
    initializeAudio();
    initializeAudioAdapter();
  }, [initializeAudio, initializeAudioAdapter]);

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
            ref={audioInputRef}
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
        onAddEffect={handleAddEffect}
        onRemoveEffect={handleRemoveEffect}
        onReorderEffects={handleReorderEffects}
        onToggleEffect={handleToggleEffect}
        onUpdateParam={handleUpdateParam}
        onSetInputGain={handleSetInputGain}
        onSetOutputGain={handleSetOutputGain}
        onSetGlobalBypass={handleSetGlobalBypass}
        onExportPreset={exportPreset}
        onImportPreset={handleImportPreset}
        undoRedo={{
          canUndo: undoRedo.canUndo,
          canRedo: undoRedo.canRedo,
          undoDescription: undoRedo.undoDescription,
          redoDescription: undoRedo.redoDescription,
          undoHistory: undoRedo.undoHistory,
          redoHistory: undoRedo.redoHistory,
          onUndo: undoRedo.undo,
          onRedo: undoRedo.redo,
          onClearHistory: undoRedo.clearHistory,
        }}
      />

      {/* AI Effect Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <AIEffectChat
          onApplySuggestion={handleAIChatSuggestion}
          onApplyChain={handleAIChatChainSuggestion}
          className="min-h-[400px]"
        />
        <AIEffectSuggester
          analyser={analyser}
          onApplySuggestion={handleAISuggestion}
          onApplyChain={handleAIChainSuggestion}
          currentGenre="guitar-clean"
        />
      </div>

      {/* Recording Controls */}
      <RecordingControls
        audioContext={audioContext}
        outputNode={outputNode}
        effectChain={effects}
        inputGain={inputGain}
        outputGain={outputGain}
        isAuthenticated={isAuthenticated}
        onNavigateToLibrary={() => setActiveView('recordings')}
      />

      {/* Export Button */}
      {inputSource === 'file' && audioBufferRef.current && (
        <Button
          onClick={() => setExportDialogOpen(true)}
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
            <Button onClick={handleExport} disabled={isExporting}>
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

  const renderRecordingsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <RecordingsLibrary
        onLoadRecording={handleLoadRecording}
      />
      <CommunityRecordings
        onLoadRecording={handleLoadRecording}
      />
    </div>
  );

  const renderRoutingView = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
      <AudioAdapterPanel
        devices={devices}
        inputChannels={inputChannels}
        outputChannels={outputChannels}
        isScanning={isScanning}
        bandwidthWarning={bandwidthWarning}
        latencyWarning={latencyWarning}
        presets={getPresets()}
        globalOutputMute={false}
        globalInputMute={false}
        disabledDevices={[]}
        onScanDevices={scanDevices}
        onCreateInputChannel={createInputChannel}
        onCreateOutputChannel={createOutputChannel}
        onRemoveChannel={removeChannel}
        onSetChannelMute={setChannelMute}
        onApplyPreset={applyPreset}
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

  // Show loading state while auth is being verified
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Loader2 className="w-12 h-12 text-cyan-500" />
          </motion.div>
          <p className="text-muted-foreground">Loading AudioNoise Studio...</p>
        </div>
      </div>
    );
  }

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
              {activeView === 'dsp' && renderDSPView()}
              {activeView === 'routing' && renderRoutingView()}
              {activeView === 'recordings' && renderRecordingsView()}
            </motion.div>
          </AnimatePresence>
        </main>

        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
          isAuthenticated={isAuthenticated}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShortcutsDialogOpen(true)}
                    data-testid="button-shortcuts"
                  >
                    <Keyboard className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Keyboard shortcuts (?)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="dsp" className="flex items-center gap-2" data-testid="tab-dsp">
              <Waves className="w-4 h-4" />
              DSP Effects
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2" data-testid="tab-routing">
              <Headphones className="w-4 h-4" />
              Audio Routing
            </TabsTrigger>
            {isAuthenticated && (
              <TabsTrigger value="recordings" className="flex items-center gap-2" data-testid="tab-recordings">
                <Music className="w-4 h-4" />
                Recordings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dsp" className="space-y-6">
            {renderDSPView()}
          </TabsContent>

          <TabsContent value="routing" className="space-y-6">
            {renderRoutingView()}
          </TabsContent>

          {isAuthenticated && (
            <TabsContent value="recordings" className="space-y-6">
              {renderRecordingsView()}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
    </div>
  );
}
