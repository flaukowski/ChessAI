import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
import {
  aiEffectConversations,
  aiEffectMessages,
  userSoundPreferences,
  type AIEffectConversation,
  type AIEffectMessage,
  type UserSoundPreferences,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authenticateToken } from "./auth";

const router = Router();

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const EFFECT_TYPES = [
  "eq",
  "distortion",
  "delay",
  "chorus",
  "compressor",
  "basspurr",
  "reverb",
] as const;

const SYSTEM_PROMPT = `You are an expert audio engineer and sound designer specializing in guitar effects, vocal processing, and music production. Your role is to help users achieve their desired sound by suggesting effect chains with precise parameter settings.

When a user describes the sound they want, you should:
1. Understand their musical context (genre, instrument, style)
2. Suggest specific effects with exact parameter values
3. Explain why each effect helps achieve their goal

Available effects and their parameters:

1. **EQ (3-Band Equalizer)**
   - lowGain: -24 to 24 dB
   - lowFreq: 20 to 500 Hz
   - midGain: -24 to 24 dB
   - midFreq: 200 to 5000 Hz
   - midQ: 0.1 to 10
   - highGain: -24 to 24 dB
   - highFreq: 1000 to 20000 Hz
   - mix: 0 to 1

2. **Distortion**
   - drive: 0 to 1 (amount of distortion)
   - tone: 0 to 1 (brightness)
   - mode: 0=soft clip, 1=hard clip, 2=tube, 3=quadratic
   - level: 0 to 1 (output level)
   - mix: 0 to 1

3. **Delay**
   - time: 1 to 2000 ms
   - feedback: 0 to 0.95
   - damping: 0 to 1 (high frequency rolloff)
   - mix: 0 to 1

4. **Chorus**
   - rate: 0.1 to 10 Hz
   - depth: 0 to 1
   - voices: 1 to 4
   - mix: 0 to 1

5. **Compressor**
   - threshold: -60 to 0 dB
   - ratio: 1 to 20
   - attack: 0.1 to 100 ms
   - release: 10 to 1000 ms
   - makeupGain: 0 to 24 dB
   - mix: 0 to 1

6. **BassPurr (Sub-harmonic enhancer)**
   - fundamental: 0 to 1
   - subOctave: 0 to 1
   - warmth: 0 to 1
   - mix: 0 to 1

7. **Reverb**
   - decay: 0.1 to 10 seconds
   - damping: 0 to 1
   - roomSize: 0 to 1
   - predelay: 0 to 100 ms
   - mix: 0 to 1

Always respond with a JSON object containing:
{
  "message": "Your conversational response explaining the suggestions",
  "effects": [
    {
      "type": "effect_name",
      "reason": "Why this effect helps",
      "params": { "param1": value, "param2": value, ... },
      "confidence": 0.0 to 1.0
    }
  ]
}

Consider the user's preferences and past interactions to personalize your suggestions.`;

interface EffectSuggestion {
  type: string;
  reason: string;
  params: Record<string, number>;
  confidence: number;
}

interface AIResponse {
  message: string;
  effects: EffectSuggestion[];
}

async function getUserPreferences(userId: string): Promise<UserSoundPreferences | null> {
  const [prefs] = await db
    .select()
    .from(userSoundPreferences)
    .where(eq(userSoundPreferences.userId, userId));
  return prefs || null;
}

async function getConversationHistory(conversationId: string): Promise<AIEffectMessage[]> {
  return db
    .select()
    .from(aiEffectMessages)
    .where(eq(aiEffectMessages.conversationId, conversationId))
    .orderBy(aiEffectMessages.createdAt);
}

async function updateUserPreferences(
  userId: string,
  newEffects: EffectSuggestion[]
): Promise<void> {
  const existing = await getUserPreferences(userId);
  
  const effectTypes = newEffects.map((e) => e.type);
  const uniqueEffects = [...new Set([...(existing?.preferredEffects || []), ...effectTypes])].slice(-10);
  
  if (existing) {
    await db
      .update(userSoundPreferences)
      .set({
        preferredEffects: uniqueEffects,
        recentEffectChains: newEffects,
        updatedAt: new Date(),
      })
      .where(eq(userSoundPreferences.userId, userId));
  } else {
    await db.insert(userSoundPreferences).values({
      userId,
      preferredEffects: uniqueEffects,
      recentEffectChains: newEffects,
    });
  }
}

router.get("/conversations", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const conversations = await db
      .select()
      .from(aiEffectConversations)
      .where(eq(aiEffectConversations.userId, userId))
      .orderBy(desc(aiEffectConversations.updatedAt));

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/conversations", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { title } = req.body;
    const [conversation] = await db
      .insert(aiEffectConversations)
      .values({
        userId,
        title: title || "New Effect Chat",
      })
      .returning();

    res.status(201).json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const [conversation] = await db
      .select()
      .from(aiEffectConversations)
      .where(eq(aiEffectConversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await getConversationHistory(id);
    res.json({ ...conversation, messages });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/conversations/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const [conversation] = await db
      .select()
      .from(aiEffectConversations)
      .where(eq(aiEffectConversations.id, id));

    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await db.delete(aiEffectMessages).where(eq(aiEffectMessages.conversationId, id));
    await db.delete(aiEffectConversations).where(eq(aiEffectConversations.id, id));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.post("/conversations/:id/messages", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!content) {
      return res.status(400).json({ error: "Message content required" });
    }

    const [conversation] = await db
      .select()
      .from(aiEffectConversations)
      .where(eq(aiEffectConversations.id, id));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.insert(aiEffectMessages).values({
      conversationId: id,
      role: "user",
      content,
    });

    const history = await getConversationHistory(id);
    const userPrefs = await getUserPreferences(userId);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (userPrefs) {
      messages.push({
        role: "system",
        content: `User preferences: Preferred effects: ${userPrefs.preferredEffects?.join(", ") || "none"}, Tone descriptors: ${userPrefs.toneDescriptors?.join(", ") || "none"}, Notes: ${userPrefs.notes || "none"}`,
      });
    }

    for (const msg of history) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      stream: true,
      max_tokens: 2048,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: "content", data: content })}\n\n`);
      }
    }

    let aiResponse: AIResponse;
    try {
      aiResponse = JSON.parse(fullResponse);
    } catch {
      aiResponse = { message: fullResponse, effects: [] };
    }

    await db.insert(aiEffectMessages).values({
      conversationId: id,
      role: "assistant",
      content: aiResponse.message,
      effectSuggestions: aiResponse.effects,
    });

    await db
      .update(aiEffectConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiEffectConversations.id, id));

    if (aiResponse.effects.length > 0 && userId) {
      await updateUserPreferences(userId, aiResponse.effects);
    }

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        message: aiResponse.message,
        effects: aiResponse.effects,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error processing message:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process message" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to process message" });
    }
  }
});

router.post("/quick-suggest", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { description, genre, currentEffects } = req.body;
    const userId = req.userId;

    if (!description) {
      return res.status(400).json({ error: "Description required" });
    }

    const userPrefs = userId ? await getUserPreferences(userId) : null;

    let contextPrompt = `The user wants: "${description}"`;
    if (genre) contextPrompt += `\nGenre/style: ${genre}`;
    if (currentEffects?.length) {
      contextPrompt += `\nCurrently active effects: ${JSON.stringify(currentEffects)}`;
    }
    if (userPrefs) {
      contextPrompt += `\nUser preferences: ${JSON.stringify(userPrefs)}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let aiResponse: AIResponse;
    try {
      aiResponse = JSON.parse(content);
    } catch {
      aiResponse = { message: content, effects: [] };
    }

    if (aiResponse.effects.length > 0 && userId) {
      await updateUserPreferences(userId, aiResponse.effects);
    }

    res.json(aiResponse);
  } catch (error) {
    console.error("Error in quick-suggest:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

router.get("/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const prefs = await getUserPreferences(userId);
    res.json(prefs || {});
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { preferredGenres, preferredEffects, toneDescriptors, notes } = req.body;
    const existing = await getUserPreferences(userId);

    if (existing) {
      await db
        .update(userSoundPreferences)
        .set({
          preferredGenres,
          preferredEffects,
          toneDescriptors,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(userSoundPreferences.userId, userId));
    } else {
      await db.insert(userSoundPreferences).values({
        userId,
        preferredGenres,
        preferredEffects,
        toneDescriptors,
        notes,
      });
    }

    const updated = await getUserPreferences(userId);
    res.json(updated);
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;
