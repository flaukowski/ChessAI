/**
 * Recording Controls Component
 * UI for recording processed audio in the studio
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Square, Pause, Play, Save, X, Loader2, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAudioRecorder, formatDuration, blobToBase64 } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';

interface RecordingControlsProps {
  audioContext: AudioContext | null;
  outputNode: AudioNode | null;
  effectChain: any[];
  inputGain: number;
  outputGain: number;
  isAuthenticated: boolean;
  onNavigateToLibrary?: () => void;
  className?: string;
}

export function RecordingControls({
  audioContext,
  outputNode,
  effectChain,
  inputGain,
  outputGain,
  isAuthenticated,
  onNavigateToLibrary,
  className,
}: RecordingControlsProps) {
  const { state, startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording } = useAudioRecorder();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const handleStartRecording = useCallback(async () => {
    if (!audioContext || !outputNode) {
      console.error('Audio context or output node not available');
      return;
    }

    try {
      await startRecording(audioContext, outputNode);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [audioContext, outputNode, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (blob) {
      setPendingBlob(blob);
      setRecordingDuration(state.duration);
      setSaveDialogOpen(true);
      setTitle(`Recording ${new Date().toLocaleString()}`);
    }
  }, [stopRecording, state.duration]);

  const handleSaveRecording = useCallback(async () => {
    if (!pendingBlob || !title.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const token = localStorage.getItem('space-child-access-token');
      if (!token) {
        throw new Error('You must be logged in to save recordings');
      }

      // Convert blob to base64
      const audioData = await blobToBase64(pendingBlob);

      // Determine format from mime type
      const mimeType = pendingBlob.type;
      let format = 'wav';
      if (mimeType.includes('webm') || mimeType.includes('ogg')) {
        format = 'ogg';
      } else if (mimeType.includes('mp4')) {
        format = 'mp3';
      }

      // Create effect chain snapshot
      const effectChainSnapshot = effectChain.map(effect => ({
        type: effect.type,
        enabled: effect.enabled,
        params: effect.params,
      }));

      const response = await fetch('/api/v1/recordings/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioData,
          format,
          title: title.trim(),
          description: description.trim() || undefined,
          duration: recordingDuration,
          effectChain: effectChainSnapshot,
          settings: {
            inputGain,
            outputGain,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save recording');
      }

      // Success - close dialog and reset
      setSaveDialogOpen(false);
      setPendingBlob(null);
      setTitle('');
      setDescription('');
      setRecordingDuration(0);

    } catch (error: any) {
      setSaveError(error.message || 'Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  }, [pendingBlob, title, description, recordingDuration, effectChain, inputGain, outputGain]);

  const handleCancelSave = useCallback(() => {
    setSaveDialogOpen(false);
    setPendingBlob(null);
    setTitle('');
    setDescription('');
    setRecordingDuration(0);
    setSaveError(null);
  }, []);

  const handleCancel = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  if (!isAuthenticated) {
    return null; // Don't show recording controls for non-authenticated users
  }

  return (
    <>
      <Card className={cn("bg-card/50 backdrop-blur", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-red-500" />
              Recording
            </div>
            {onNavigateToLibrary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToLibrary}
                className="text-xs"
              >
                <Library className="w-4 h-4 mr-1" />
                My Recordings
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {/* Recording Status */}
            <AnimatePresence mode="wait">
              {state.isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 flex-1"
                >
                  {/* Recording indicator */}
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-3 h-3 rounded-full bg-red-500"
                      animate={{ opacity: state.isPaused ? 0.5 : [1, 0.5, 1] }}
                      transition={{ repeat: state.isPaused ? 0 : Infinity, duration: 1 }}
                    />
                    <span className="font-mono text-lg tabular-nums">
                      {formatDuration(state.duration)}
                    </span>
                  </div>

                  {/* Control buttons */}
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Pause/Resume */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={state.isPaused ? resumeRecording : pauseRecording}
                      className="h-9 w-9"
                    >
                      {state.isPaused ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </Button>

                    {/* Stop (save) */}
                    <Button
                      variant="glass"
                      size="icon"
                      onClick={handleStopRecording}
                      className="h-9 w-9 bg-red-500 hover:bg-red-600"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </Button>

                    {/* Cancel */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancel}
                      className="h-9 w-9"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 flex-1"
                >
                  <Button
                    onClick={handleStartRecording}
                    disabled={!audioContext || !outputNode}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Circle className="w-4 h-4 mr-2 fill-current" />
                    Start Recording
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Record your processed audio with current effects
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Save Recording Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Save Recording
            </DialogTitle>
            <DialogDescription>
              Give your recording a name and optional description
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My awesome recording"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes about this recording..."
                className="bg-background min-h-[80px]"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Duration: {formatDuration(recordingDuration)}</p>
              <p>Effects: {effectChain.filter(e => e.enabled).length} active</p>
            </div>

            {saveError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSave} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRecording}
              disabled={!title.trim() || isSaving}
              className="bg-gradient-to-r from-green-500 to-emerald-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Recording
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecordingControls;
