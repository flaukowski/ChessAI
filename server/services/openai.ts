import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

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
      const enhancementResponse = await openai.chat.completions.create({
        model: "gpt-5",
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
      });

      enhancedPrompt = enhancementResponse.choices[0].message.content || params.prompt;
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    if (!response.data || !response.data[0]) {
      throw new Error("No image data returned from OpenAI");
    }

    return {
      url: response.data[0].url!,
      revisedPrompt: response.data[0].revised_prompt || undefined,
    };
  } catch (error) {
    console.error("OpenAI image generation error:", error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function enhanceMusicPrompt(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
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
    });

    return response.choices[0].message.content || prompt;
  } catch (error) {
    console.error("OpenAI prompt enhancement error:", error);
    return prompt; // Fallback to original prompt
  }
}
