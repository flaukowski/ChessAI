import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Music, Palette, Sliders, Sparkles, ChevronDown, PenTool } from "lucide-react";
import { MUSIC_GENRES, MUSIC_MODELS, QUICK_TAGS, MAX_PROMPT_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PromptSidebarProps {
  onGenerate: (params: GenerationParams) => void;
  isGenerating?: boolean;
}

export interface GenerationParams {
  prompt: string;
  style: string;
  title: string;
  model: string;
  instrumental: boolean;
  duration: number;
  customMode: boolean;
  negativeTags: string;
  vocalGender?: "m" | "f";
  styleWeight: number;
  weirdnessConstraint: number;
}

export function PromptSidebar({ onGenerate, isGenerating = false }: PromptSidebarProps) {
  const [activeTab, setActiveTab] = useState<"music" | "image">("music");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("indie-pop");
  const [title, setTitle] = useState("");
  const [model, setModel] = useState("V5");
  const [instrumental, setInstrumental] = useState(false);
  const [duration, setDuration] = useState([180]);
  const [customMode, setCustomMode] = useState(false);
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState<"m" | "f" | undefined>();
  const [styleWeight, setStyleWeight] = useState([0.65]);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState([0.5]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    onGenerate({
      prompt: prompt.trim(),
      style,
      title: title.trim(),
      model,
      instrumental,
      duration: duration[0],
      customMode,
      negativeTags: negativeTags.trim(),
      vocalGender,
      styleWeight: styleWeight[0],
      weirdnessConstraint: weirdnessConstraint[0],
    });
  };

  const addQuickTag = (tag: string) => {
    const newPrompt = prompt.trim() ? `${prompt}, ${tag.toLowerCase()}` : tag.toLowerCase();
    if (newPrompt.length <= MAX_PROMPT_LENGTH) {
      setPrompt(newPrompt);
    }
  };

  return (
    <aside className="w-80 border-r border-border bg-card flex flex-col overflow-hidden" data-testid="prompt-sidebar">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-500 to-purple-600 bg-clip-text text-transparent">
              SonicVision
            </h1>
            <p className="text-xs text-muted-foreground">Powered by AudioNoise DSP</p>
          </div>
        </div>
      </div>

      {/* Generation Tabs */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "music"
              ? "bg-gradient-to-r from-primary to-purple-600 text-white border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("music")}
          data-testid="tab-music"
        >
          <Music className="w-4 h-4 mr-2 inline" />
          Music
        </button>
        <button
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "image"
              ? "bg-gradient-to-r from-accent to-blue-600 text-white border-b-2 border-accent"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("image")}
          data-testid="tab-image"
        >
          <Palette className="w-4 h-4 mr-2 inline" />
          Image
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "music" && (
          <>
            {/* Text Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PenTool className="w-4 h-4 text-primary" />
                Describe Your Music
              </Label>
              <div className="relative">
                <Textarea
                  rows={4}
                  className="resize-none"
                  placeholder="An upbeat indie pop song about coding at night with synth melodies and dreamy vocals..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={MAX_PROMPT_LENGTH}
                  data-testid="input-prompt"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {prompt.length}/{MAX_PROMPT_LENGTH} characters
              </p>
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4 text-accent" />
                Genre & Style
              </Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger data-testid="select-genre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSIC_GENRES.map((genre) => (
                    <SelectItem key={genre.value} value={genre.value}>
                      {genre.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Song Title (Optional)</Label>
              <input
                type="text"
                className="w-full p-3 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter song title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            {/* Quick Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Quick Tags</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addQuickTag(tag)}
                    className="px-3 py-1 text-xs rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    data-testid={`tag-${tag.toLowerCase()}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Options */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-primary transition-colors" data-testid="toggle-advanced">
                <span className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Advanced Options
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Model Version</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_MODELS.map((modelOption) => (
                        <SelectItem key={modelOption.value} value={modelOption.value}>
                          <div>
                            <div className="font-medium">{modelOption.label}</div>
                            <div className="text-xs text-muted-foreground">{modelOption.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Duration</span>
                    <span className="text-primary font-medium">
                      {Math.floor(duration[0] / 60)}:{(duration[0] % 60).toString().padStart(2, "0")}
                    </span>
                  </Label>
                  <Slider
                    value={duration}
                    onValueChange={setDuration}
                    min={30}
                    max={480}
                    step={15}
                    data-testid="slider-duration"
                  />
                </div>

                {/* Instrumental Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Instrumental Only</Label>
                  <Switch
                    checked={instrumental}
                    onCheckedChange={setInstrumental}
                    data-testid="switch-instrumental"
                  />
                </div>

                {/* Custom Mode */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Custom Mode</Label>
                  <Switch
                    checked={customMode}
                    onCheckedChange={setCustomMode}
                    data-testid="switch-custom"
                  />
                </div>

                {/* Vocal Gender */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Vocal Gender</Label>
                  <Select value={vocalGender || ""} onValueChange={(value) => setVocalGender(value as "m" | "f" | undefined)}>
                    <SelectTrigger data-testid="select-vocal-gender">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Auto</SelectItem>
                      <SelectItem value="m">Male</SelectItem>
                      <SelectItem value="f">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Style Weight */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Style Weight</span>
                    <span className="text-primary font-medium">{styleWeight[0].toFixed(2)}</span>
                  </Label>
                  <Slider
                    value={styleWeight}
                    onValueChange={setStyleWeight}
                    min={0}
                    max={1}
                    step={0.05}
                    data-testid="slider-style-weight"
                  />
                </div>

                {/* Creativity */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Creativity</span>
                    <span className="text-primary font-medium">{weirdnessConstraint[0].toFixed(2)}</span>
                  </Label>
                  <Slider
                    value={weirdnessConstraint}
                    onValueChange={setWeirdnessConstraint}
                    min={0}
                    max={1}
                    step={0.05}
                    data-testid="slider-creativity"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {activeTab === "image" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center space-y-2">
              <Palette className="w-12 h-12 mx-auto opacity-50" />
              <p className="text-sm">Image generation coming soon</p>
              <p className="text-xs">Generate visuals to pair with your music</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        {activeTab === "music" && (
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-4 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-opacity text-white font-semibold"
            data-testid="button-generate"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Music"}
          </Button>
        )}
      </div>
    </aside>
  );
}
