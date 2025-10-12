import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

async function withRetry<T>(fn: () => Promise<T>, opts: { attempts?: number; baseDelayMs?: number } = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // Retry on rate limits and server/network errors when possible
      const status = (err?.status as number) || (err?.response?.status as number) || 0;
      const retriable = status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);
      if (!retriable || i === attempts - 1) break;
      const jitter = Math.floor(Math.random() * 150);
      const delay = base * Math.pow(2, i) + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export interface GenerateImageParams {
  prompt: string;
  musicContext?: string;
}

export interface ImageGenerationResult {
  url: string;
  revisedPrompt?: string;
}

export async function generateImage(params: GenerateImageParams): Promise<ImageGenerationResult> {
  try {
    // Enhance the prompt with music context if provided
    let enhancedPrompt = params.prompt;
    
    if (params.musicContext) {
      const enhancementResponse = await withRetry(() => openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at creating visual art prompts that complement music. Create a detailed, artistic image description that would visually represent the music described. Focus on colors, mood, atmosphere, and visual elements that match the musical style and energy. Keep it under 400 characters for DALL-E."
          },
          {
            role: "user",
            content: `Music context: ${params.musicContext}\nOriginal prompt: ${params.prompt}\n\nCreate an enhanced visual prompt:`
          }
        ],
        max_completion_tokens: 100,
      })) as any;

      enhancedPrompt = (enhancementResponse as any).choices[0].message.content || params.prompt;
    }

    const response = await withRetry(() => openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    })) as any;

    if (!response.data || !response.data[0]) {
      throw new Error("No image data returned from OpenAI");
    }

    return {
      url: response.data[0].url!,
      revisedPrompt: response.data[0].revised_prompt || undefined,
    };
  } catch (error: any) {
    console.error("OpenAI image generation error:", error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function enhanceMusicPrompt(prompt: string): Promise<string> {
  try {
    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert music producer and songwriter. Enhance the user's music description to be more detailed and specific for AI music generation. Include genre, mood, instruments, tempo, and musical elements. Keep it concise but descriptive."
        },
        {
          role: "user",
          content: `Enhance this music prompt: ${prompt}`
        }
      ],
      max_completion_tokens: 150,
    })) as any;

    return (response as any).choices[0].message.content || prompt;
  } catch (error: any) {
    console.error("OpenAI prompt enhancement error:", error);
    return prompt; // Fallback to original prompt
  }
}
