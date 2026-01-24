/**
 * Comments Section Component
 * Display threaded comments with reply functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Send,
  Reply,
  MoreHorizontal,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface CommentUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  user: CommentUser;
  parentId?: string | null;
  replies?: Comment[];
  replyCount?: number;
}

interface CommentsSectionProps {
  recordingId: string;
  currentUserId?: string;
  className?: string;
}

export function CommentsSection({
  recordingId,
  currentUserId,
  className
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/social/recordings/${recordingId}/comments`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = useCallback(async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;

    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/social/recordings/${recordingId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          parentId: parentId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const newCommentData = await response.json();

      if (parentId) {
        // Add reply to parent comment
        setComments(prevComments =>
          addReplyToComment(prevComments, parentId, newCommentData)
        );
        setReplyContent('');
        setReplyingTo(null);
        // Auto-expand replies when adding a new one
        setExpandedReplies(prev => new Set([...prev, parentId]));
      } else {
        // Add new top-level comment
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
      }
    } catch (err: any) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [recordingId, newComment, replyContent, isSubmitting]);

  const addReplyToComment = (comments: Comment[], parentId: string, reply: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), reply],
          replyCount: (comment.replyCount || 0) + 1,
        };
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToComment(comment.replies, parentId, reply),
        };
      }
      return comment;
    });
  };

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/v1/social/recordings/${recordingId}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove comment from state
      const removeComment = (comments: Comment[]): Comment[] => {
        return comments
          .filter(c => c.id !== commentId)
          .map(c => ({
            ...c,
            replies: c.replies ? removeComment(c.replies) : [],
          }));
      };

      setComments(prev => removeComment(prev));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }, [recordingId]);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const hasReplies = (comment.replies && comment.replies.length > 0) || (comment.replyCount && comment.replyCount > 0);
    const isExpanded = expandedReplies.has(comment.id);
    const isOwner = currentUserId === comment.user.id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn("group", depth > 0 && "ml-8 mt-3")}
      >
        <div className="flex gap-3">
          <Avatar
            src={comment.user.avatarUrl}
            alt={comment.user.username}
            fallback={comment.user.username}
            size="sm"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{comment.user.username}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            <p className="text-sm mt-1 break-words whitespace-pre-wrap">
              {comment.content}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setReplyingTo(replyingTo === comment.id ? null : comment.id);
                  setReplyContent('');
                }}
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </Button>

              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => toggleReplies(comment.id)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      Hide replies
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      {comment.replyCount || comment.replies?.length} {(comment.replyCount || comment.replies?.length) === 1 ? 'reply' : 'replies'}
                    </>
                  )}
                </Button>
              )}

              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Reply input */}
            <AnimatePresence>
              {replyingTo === comment.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={`Reply to ${comment.user.username}...`}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleSubmitComment(comment.id);
                        }
                      }}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleSubmitComment(comment.id)}
                        disabled={!replyContent.trim() || isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nested replies */}
            <AnimatePresence>
              {isExpanded && comment.replies && comment.replies.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {comment.replies.map(reply => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      depth={depth + 1}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  const totalComments = comments.reduce((total, comment) => {
    return total + 1 + (comment.replyCount || comment.replies?.length || 0);
  }, 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-medium">
          Comments {totalComments > 0 && `(${totalComments})`}
        </h3>
      </div>

      {/* New comment form */}
      <div className="flex gap-3">
        <Textarea
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmitComment();
            }
          }}
        />
        <Button
          onClick={() => handleSubmitComment()}
          disabled={!newComment.trim() || isSubmitting}
          className="self-end"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-destructive">
          <p>{error}</p>
          <Button variant="outline" onClick={fetchComments} className="mt-4">
            Try Again
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No comments yet</p>
          <p className="text-sm mt-1">Be the first to comment!</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4 pr-4">
            <AnimatePresence initial={false}>
              {comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default CommentsSection;
