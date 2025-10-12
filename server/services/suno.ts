import axios from "axios";

// Using SunoAPI.org as the third-party provider for Suno API access
const SUNO_API_URL = "https://api.sunoapi.org/api/v1";
const SUNO_API_KEY = process.env.SUNO_API_KEY || process.env.SUNO_API_KEY_ENV_VAR || "default_key";

async function withRetry<T>(fn: () => Promise<T>, opts: { attempts?: number; baseDelayMs?: number } = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = (err?.response?.status as number) || 0;
      // Retry on 429/5xx/network
      const retriable = status === 0 || status === 429 || (status >= 500 && status < 600);
      if (!retriable || i === attempts - 1) break;
      const jitter = Math.floor(Math.random() * 150);
      const delay = base * Math.pow(2, i) + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export interface SunoGenerationParams {
  prompt: string;
  style?: string;
  title?: string;
  customMode?: boolean;
  instrumental?: boolean;
  model?: "V5" | "V4_5PLUS" | "V4_5" | "V4" | "V3_5";
  negativeTags?: string;
  vocalGender?: "m" | "f";
  styleWeight?: number;
  weirdnessConstraint?: number;
}

export interface SunoGenerationResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  audioUrl?: string;
  imageUrl?: string;
  title?: string;
  duration?: number;
  metadata?: {
    bpm?: number;
    key?: string;
    genre?: string;
  };
}

export async function generateMusic(params: SunoGenerationParams): Promise<SunoGenerationResult> {
  try {
    const requestData = {
      prompt: params.prompt,
      style: params.style || "",
      title: params.title || "",
      customMode: params.customMode || false,
      instrumental: params.instrumental || false,
      model: params.model || "V5",
      negativeTags: params.negativeTags || "",
      vocalGender: params.vocalGender || undefined,
      styleWeight: params.styleWeight || 0.65,
      weirdnessConstraint: params.weirdnessConstraint || 0.50,
    };

    const response = await withRetry(() => axios.post(`${SUNO_API_URL}/generate`, requestData, {
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 second timeout
    }));

    const data = (response as any).data;
    
    return {
      taskId: data.taskId || data.id,
      status: "pending",
      audioUrl: data.audioUrl || undefined,
      imageUrl: data.imageUrl || undefined,
      title: data.title || params.title,
      duration: data.duration || undefined,
      metadata: data.metadata || undefined,
    };
  } catch (error) {
    console.error("Suno API generation error:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(`Suno API error: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to generate music: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function checkGenerationStatus(taskId: string): Promise<SunoGenerationResult> {
  try {
    const response = await withRetry(() => axios.get(`${SUNO_API_URL}/status/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
      },
      timeout: 10000,
    }));

    const data = (response as any).data;
    
    return {
      taskId: taskId,
      status: data.status === "completed" ? "completed" : 
              data.status === "failed" ? "failed" : 
              data.status === "processing" ? "processing" : "pending",
      audioUrl: data.audioUrl || data.audio_url || undefined,
      imageUrl: data.imageUrl || data.image_url || undefined,
      title: data.title || undefined,
      duration: data.duration || undefined,
      metadata: {
        bpm: data.bpm || undefined,
        key: data.key || undefined,
        genre: data.genre || data.style || undefined,
      },
    };
  } catch (error) {
    console.error("Suno API status check error:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(`Suno API status error: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to check generation status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function downloadAudio(audioUrl: string): Promise<Buffer> {
  try {
    const response = await withRetry(() => axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout for downloads
    }), { attempts: 2 });
    
    return Buffer.from((response as any).data);
  } catch (error) {
    console.error("Audio download error:", error);
    throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
