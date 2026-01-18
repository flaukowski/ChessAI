/**
 * Community Recordings Component
 * Browse and listen to public recordings from other users
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Users, Clock, Music, Loader2, RefreshCw, Search, Upload, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDuration } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';

interface PublicRecording {
  id: string;
  title: string;
  description?: string | null;
  duration: number;
  fileSize: number;
  fileUrl: string;
  format: string;
  playCount: number;
  createdAt: string;
  effectChain?: any[] | null;
}

interface CommunityRecordingsProps {
  onLoadRecording?: (recordingUrl: string, title: string) => void;
  className?: string;
}

export function CommunityRecordings({ onLoadRecording, className }: CommunityRecordingsProps) {
  const [recordings, setRecordings] = useState<PublicRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchRecordings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/recordings/public');

      if (!response.ok) {
        throw new Error('Failed to fetch community recordings');
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

  const handlePlay = useCallback((recording: PublicRecording) => {
    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = recording.fileUrl;
        audioRef.current.play();
        setPlayingId(recording.id);

        // Track play count
        fetch(`/api/v1/recordings/${recording.id}/play`, { method: 'POST' });
      }
    }
  }, [playingId]);

  const filteredRecordings = recordings.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onError={() => setPlayingId(null)}
      />

      <Card className={cn("bg-card/50 backdrop-blur", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Community Recordings
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchRecordings} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Discover recordings shared by the AudioNoise community
          </p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search community recordings..."
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
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No community recordings yet</p>
                  <p className="text-sm mt-2">Be the first to share a recording!</p>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence>
                  {filteredRecordings.map((recording) => (
                    <motion.div
                      key={recording.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "p-4 rounded-lg border transition-all cursor-pointer group",
                        playingId === recording.id
                          ? "bg-purple-500/10 border-purple-500/30"
                          : "bg-background/50 border-border hover:border-purple-500/30 hover:bg-purple-500/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Play button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-12 w-12 shrink-0 rounded-full",
                            playingId === recording.id
                              ? "bg-purple-500 text-white hover:bg-purple-600"
                              : "bg-purple-500/10 group-hover:bg-purple-500/20"
                          )}
                          onClick={() => handlePlay(recording)}
                        >
                          {playingId === recording.id ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5 ml-0.5" />
                          )}
                        </Button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{recording.title}</h4>
                          {recording.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {recording.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(recording.duration)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {recording.playCount} plays
                            </span>
                            <span>{formatDate(recording.createdAt)}</span>
                          </div>

                          {/* Effect badges */}
                          {recording.effectChain && recording.effectChain.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {recording.effectChain
                                .filter((e: any) => e.enabled)
                                .slice(0, 3)
                                .map((effect: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {effect.type}
                                  </Badge>
                                ))}
                              {recording.effectChain.filter((e: any) => e.enabled).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{recording.effectChain.filter((e: any) => e.enabled).length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Load button */}
                      {onLoadRecording && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadRecording(recording.fileUrl, recording.title);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Load in Studio
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default CommunityRecordings;
