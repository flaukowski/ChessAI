import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Send,
  Loader2,
  MessageCircle,
  Music,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSpaceChildAuth } from "@/hooks/use-space-child-auth";

export interface EffectSuggestion {
  type: string;
  reason: string;
  params: Record<string, number>;
  confidence: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  effectSuggestions?: EffectSuggestion[];
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface AIEffectChatProps {
  onApplySuggestion: (type: string, params: Record<string, number>) => void;
  onApplyChain?: (suggestions: EffectSuggestion[]) => void;
  className?: string;
}

const QUICK_PROMPTS = [
  "Warm vintage tone with subtle shimmer",
  "Modern punchy sound for electronic music",
  "Classic rock guitar crunch",
  "Lo-fi dreamy vocals",
  "Thick bass with presence",
  "Ambient spacious atmosphere",
];

export function AIEffectChat({
  onApplySuggestion,
  onApplyChain,
  className,
}: AIEffectChatProps) {
  const { user, isAuthenticated } = useSpaceChildAuth();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/v1/ai-effects/conversations"],
    enabled: isAuthenticated,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiRequest("POST", "/api/v1/ai-effects/conversations", { title });
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      setCurrentConversationId(data.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai-effects/conversations"] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/v1/ai-effects/conversations/${id}`);
    },
    onSuccess: () => {
      if (currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai-effects/conversations"] });
    },
  });

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await apiRequest("GET", `/api/v1/ai-effects/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentConversationId(id);
        setMessages(data.messages || []);
        setShowQuickPrompts(false);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    let conversationId = currentConversationId;

    if (!conversationId) {
      const res = await apiRequest("POST", "/api/v1/ai-effects/conversations", {
        title: content.slice(0, 50),
      });
      const newConversation = await res.json();
      conversationId = newConversation.id;
      setCurrentConversationId(conversationId);
      queryClient.invalidateQueries({ queryKey: ["/api/v1/ai-effects/conversations"] });
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setShowQuickPrompts(false);

    try {
      const response = await fetch(`/api/v1/ai-effects/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let fullContent = "";
      let finalEffects: EffectSuggestion[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content") {
                fullContent += data.data;
                setStreamingContent(fullContent);
              } else if (data.type === "done") {
                finalEffects = data.effects || [];
              }
            } catch {
              // Ignore JSON parse errors for partial data
            }
          }
        }
      }

      let displayMessage = fullContent;
      try {
        const parsed = JSON.parse(fullContent);
        displayMessage = parsed.message || fullContent;
        finalEffects = parsed.effects || finalEffects;
      } catch {
        // Use raw content if not valid JSON
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: displayMessage,
        effectSuggestions: finalEffects,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setShowQuickPrompts(true);
    inputRef.current?.focus();
  };

  const toggleSuggestionDetails = (msgId: string) => {
    setExpandedSuggestions((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (confidence >= 0.7) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (!isAuthenticated) {
    return (
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Effect Designer
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
          <Lock className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            Sign in to use AI-powered effect suggestions
          </p>
          <p className="text-xs text-muted-foreground">
            Get personalized effect chains based on your style preferences
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Effect Designer
          </CardTitle>
          <div className="flex items-center gap-1">
            {currentConversationId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={startNewChat}
                data-testid="button-new-chat"
              >
                <Plus className="w-3 h-3 mr-1" />
                New
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        {/* Conversation History Dropdown */}
        {conversations.length > 0 && !currentConversationId && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2">Recent chats:</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {conversations.slice(0, 3).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className="w-full text-left text-xs p-2 rounded border hover:bg-muted/50 truncate"
                  data-testid={`button-load-conversation-${conv.id}`}
                >
                  <MessageCircle className="w-3 h-3 inline mr-1" />
                  {conv.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && showQuickPrompts && (
              <div className="text-center py-4">
                <Music className="w-10 h-10 mx-auto mb-3 text-purple-400 opacity-60" />
                <p className="text-sm text-muted-foreground mb-4">
                  Describe the sound you want to create
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="cursor-pointer hover:bg-purple-500/20 transition-colors text-xs"
                      onClick={() => handleQuickPrompt(prompt)}
                      data-testid={`badge-quick-prompt-${idx}`}
                    >
                      {prompt}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg p-3",
                  msg.role === "user"
                    ? "bg-purple-500/10 ml-8"
                    : "bg-muted/50 mr-4"
                )}
                data-testid={`message-${msg.role}-${msg.id}`}
              >
                <p className="text-sm">{msg.content}</p>

                {msg.effectSuggestions && msg.effectSuggestions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => toggleSuggestionDetails(msg.id)}
                      className="flex items-center text-xs text-purple-400 hover:text-purple-300"
                      data-testid={`button-toggle-suggestions-${msg.id}`}
                    >
                      {expandedSuggestions[msg.id] ? (
                        <ChevronUp className="w-3 h-3 mr-1" />
                      ) : (
                        <ChevronDown className="w-3 h-3 mr-1" />
                      )}
                      {msg.effectSuggestions.length} effect suggestions
                    </button>

                    {expandedSuggestions[msg.id] && (
                      <div className="space-y-2">
                        {msg.effectSuggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded border bg-background/50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium capitalize">
                                  {suggestion.type}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    getConfidenceColor(suggestion.confidence)
                                  )}
                                >
                                  {Math.round(suggestion.confidence * 100)}%
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  onApplySuggestion(suggestion.type, suggestion.params)
                                }
                                data-testid={`button-apply-effect-${suggestion.type}-${idx}`}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Apply
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.reason}
                            </p>
                          </div>
                        ))}

                        {onApplyChain && msg.effectSuggestions.length > 1 && (
                          <Button
                            size="sm"
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs h-7"
                            onClick={() => onApplyChain(msg.effectSuggestions!)}
                            data-testid={`button-apply-all-${msg.id}`}
                          >
                            Apply All Effects
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isStreaming && streamingContent && (
              <div className="bg-muted/50 rounded-lg p-3 mr-4">
                <p className="text-sm">{streamingContent}</p>
                <Loader2 className="w-3 h-3 animate-spin mt-2" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex gap-2 mt-3 flex-shrink-0">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your desired sound..."
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            className="text-sm"
            data-testid="input-chat-message"
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="px-3"
            data-testid="button-send-message"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
