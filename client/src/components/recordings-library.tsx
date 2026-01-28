/**
 * Recordings Library Component
 * Displays user's recordings with playback and management controls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Trash2, Globe, Lock, MoreVertical, Edit2, Share2, Copy, Check,
  Music, Clock, Calendar, Loader2, RefreshCw, Search, Download, Upload, FileAudio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDuration } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';
import {
  exportAudio,
  loadAudioFile,
  downloadAudio,
  isFormatSupported,
  FORMAT_INFO,
  type AudioFormat,
} from '@/lib/dsp/audio-export';

interface Recording {
  id: string;
  title: string;
  description?: string | null;
  duration: number;
  fileSize: number;
  fileUrl: string;
  format: string;
  isPublic: boolean;
  shareToken?: string | null;
  playCount: number;
  createdAt: string;
  effectChain?: any[] | null;
}

interface RecordingsLibraryProps {
  onLoadRecording?: (recordingUrl: string, title: string) => void;
  className?: string;
}

export function RecordingsLibrary({ onLoadRecording, className }: RecordingsLibraryProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingRecording, setSharingRecording] = useState<Recording | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadingRecording, setDownloadingRecording] = useState<Recording | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'original' | 'wav' | 'mp3' | 'ogg'>('original');
  const [isDownloading, setIsDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchRecordings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/recordings', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }

      const data = await response.json();
      setRecordings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handlePlay = useCallback((recording: Recording) => {
    if (playingId === recording.id) {
      // Pause
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play
      if (audioRef.current) {
        // Stop any currently playing audio first
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        // Set new source and wait for it to load before playing
        audioRef.current.src = recording.fileUrl;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setPlayingId(recording.id);
              // Track play count
              fetch(`/api/v1/recordings/${recording.id}/play`, { method: 'POST', credentials: 'include' });
            })
            .catch((error) => {
              console.error('Playback failed:', error);
              setPlayingId(null);
            });
        }
      }
    }
  }, [playingId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      const response = await fetch(`/api/v1/recordings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (playingId === id) {
          audioRef.current?.pause();
          setPlayingId(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  }, [playingId]);

  const handleTogglePublic = useCallback(async (recording: Recording) => {
    try {
      const response = await fetch(`/api/v1/recordings/${recording.id}/toggle-public`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const updated = await response.json();
        setRecordings(prev => prev.map(r => r.id === recording.id ? updated : r));
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  }, []);

  const handleEdit = useCallback((recording: Recording) => {
    setEditingRecording(recording);
    setEditTitle(recording.title);
    setEditDescription(recording.description || '');
    setEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingRecording) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/recordings/${editingRecording.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setRecordings(prev => prev.map(r => r.id === editingRecording.id ? updated : r));
        setEditDialogOpen(false);
      }
    } catch (err) {
      console.error('Failed to update recording:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editingRecording, editTitle, editDescription]);

  const handleShare = useCallback((recording: Recording) => {
    setSharingRecording(recording);
    setShareDialogOpen(true);
    setCopied(false);
  }, []);

  const copyShareLink = useCallback(() => {
    if (!sharingRecording?.shareToken) return;
    const shareUrl = `${window.location.origin}/api/v1/recordings/share/${sharingRecording.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sharingRecording]);

  const handleOpenDownload = useCallback((recording: Recording) => {
    setDownloadingRecording(recording);
    setDownloadFormat('original');
    setDownloadDialogOpen(true);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!downloadingRecording) return;

    if (downloadFormat === 'original') {
      // Direct download of original file
      const a = document.createElement('a');
      a.href = downloadingRecording.fileUrl;
      a.download = `${downloadingRecording.title}.${downloadingRecording.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadDialogOpen(false);
      return;
    }

    // Convert to selected format
    setIsDownloading(true);
    try {
      // Fetch the audio file
      const response = await fetch(downloadingRecording.fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Create audio context and decode
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();

      // Export to selected format (no effects chain, just format conversion)
      const blob = await exportAudio(
        audioBuffer,
        [], // No effects
        1, // Input gain
        1, // Output gain
        {
          format: downloadFormat as AudioFormat,
          normalize: false,
        }
      );

      // Download the converted file
      downloadAudio(blob, downloadingRecording.title, downloadFormat as AudioFormat);
      setDownloadDialogOpen(false);
    } catch (err) {
      console.error('Download/conversion failed:', err);
      alert('Failed to convert recording. Please try downloading the original format.');
    } finally {
      setIsDownloading(false);
    }
  }, [downloadingRecording, downloadFormat]);

  const filteredRecordings = recordings.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onError={() => setPlayingId(null)}
      />

      <Card className={cn("bg-card/50 backdrop-blur", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Music className="w-5 h-5 text-cyan-500" />
              My Recordings
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchRecordings} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <p>{error}</p>
              <Button variant="outline" onClick={fetchRecordings} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <p>No recordings match your search</p>
              ) : (
                <>
                  <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recordings yet</p>
                  <p className="text-sm mt-2">Start recording to see your audio here</p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                <AnimatePresence>
                  {filteredRecordings.map((recording) => (
                    <motion.div
                      key={recording.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "p-3 rounded-lg border transition-colors",
                        playingId === recording.id
                          ? "bg-cyan-500/10 border-cyan-500/30"
                          : "bg-background/50 border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Play button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => handlePlay(recording)}
                        >
                          {playingId === recording.id ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </Button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium truncate">{recording.title}</h4>
                            <Badge variant={recording.isPublic ? "default" : "secondary"} className="shrink-0">
                              {recording.isPublic ? (
                                <><Globe className="w-3 h-3 mr-1" /> Public</>
                              ) : (
                                <><Lock className="w-3 h-3 mr-1" /> Private</>
                              )}
                            </Badge>
                          </div>
                          {recording.description && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {recording.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(recording.duration)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(recording.createdAt)}
                            </span>
                            <span>{formatFileSize(recording.fileSize)}</span>
                            <span>{recording.playCount} plays</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(recording)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShare(recording)}>
                              <Share2 className="w-4 h-4 mr-2" />
                              Share Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTogglePublic(recording)}>
                              {recording.isPublic ? (
                                <><Lock className="w-4 h-4 mr-2" /> Make Private</>
                              ) : (
                                <><Globe className="w-4 h-4 mr-2" /> Make Public</>
                              )}
                            </DropdownMenuItem>
                            {onLoadRecording && (
                              <DropdownMenuItem onClick={() => onLoadRecording(recording.fileUrl, recording.title)}>
                                <Upload className="w-4 h-4 mr-2" />
                                Load in Studio
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleOpenDownload(recording)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(recording.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recording</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Recording</DialogTitle>
            <DialogDescription>
              Share this recording with anyone using the link below
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={sharingRecording?.shareToken
                  ? `${window.location.origin}/api/v1/recordings/share/${sharingRecording.shareToken}`
                  : ''
                }
              />
              <Button onClick={copyShareLink}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileAudio className="w-5 h-5" />
              Download Recording
            </DialogTitle>
            <DialogDescription>
              Choose a format to download "{downloadingRecording?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={downloadFormat}
                onValueChange={(value) => setDownloadFormat(value as typeof downloadFormat)}
              >
                <SelectTrigger data-testid="select-download-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">
                    Original ({downloadingRecording?.format?.toUpperCase() || 'OGG'})
                  </SelectItem>
                  <SelectItem value="wav">
                    WAV - Uncompressed, best quality
                  </SelectItem>
                  <SelectItem value="mp3" disabled={!isFormatSupported('mp3')}>
                    MP3 - Compressed, widely compatible {!isFormatSupported('mp3') && '(Not supported)'}
                  </SelectItem>
                  <SelectItem value="ogg" disabled={!isFormatSupported('ogg')}>
                    OGG - Compressed, open format {!isFormatSupported('ogg') && '(Not supported)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {downloadFormat !== 'original' && (
              <p className="text-sm text-muted-foreground">
                The recording will be converted to {FORMAT_INFO[downloadFormat as AudioFormat]?.name || downloadFormat.toUpperCase()} format before downloading.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialogOpen(false)} disabled={isDownloading}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={isDownloading} data-testid="button-download-confirm">
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecordingsLibrary;
