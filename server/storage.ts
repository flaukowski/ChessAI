import { 
  users,
  musicGenerations,
  imageGenerations,
  type User, 
  type InsertUser, 
  type MusicGeneration, 
  type InsertMusicGeneration, 
  type ImageGeneration, 
  type InsertImageGeneration 
} from "@shared/schema";
import { db } from "./db";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createMusicGeneration(generation: InsertMusicGeneration & { userId?: string }): Promise<MusicGeneration>;
  getMusicGeneration(id: string): Promise<MusicGeneration | undefined>;
  updateMusicGeneration(id: string, updates: Partial<MusicGeneration>): Promise<MusicGeneration | undefined>;
  getUserMusicGenerations(userId?: string, limit?: number): Promise<MusicGeneration[]>;
  
  createImageGeneration(generation: InsertImageGeneration & { userId?: string }): Promise<ImageGeneration>;
  getImageGeneration(id: string): Promise<ImageGeneration | undefined>;
  updateImageGeneration(id: string, updates: Partial<ImageGeneration>): Promise<ImageGeneration | undefined>;
  getUserImageGenerations(userId?: string, limit?: number): Promise<ImageGeneration[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createMusicGeneration(generation: InsertMusicGeneration & { userId?: string }): Promise<MusicGeneration> {
    const [musicGeneration] = await db
      .insert(musicGenerations)
      .values({
        prompt: generation.prompt,
        style: generation.style || null,
        title: generation.title || null,
        model: generation.model || "V5",
        instrumental: generation.instrumental ?? false,
        duration: generation.duration || null,
        userId: generation.userId || null,
        metadata: null,
      })
      .returning();
    return musicGeneration;
  }

  async getMusicGeneration(id: string): Promise<MusicGeneration | undefined> {
    const [musicGeneration] = await db
      .select()
      .from(musicGenerations)
      .where(eq(musicGenerations.id, id));
    return musicGeneration || undefined;
  }

  async updateMusicGeneration(id: string, updates: Partial<MusicGeneration>): Promise<MusicGeneration | undefined> {
    const [updated] = await db
      .update(musicGenerations)
      .set(updates)
      .where(eq(musicGenerations.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserMusicGenerations(userId?: string, limit: number = 50): Promise<MusicGeneration[]> {
    if (userId) {
      return await db
        .select()
        .from(musicGenerations)
        .where(eq(musicGenerations.userId, userId))
        .orderBy(desc(musicGenerations.createdAt))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(musicGenerations)
      .orderBy(desc(musicGenerations.createdAt))
      .limit(limit);
  }

  async createImageGeneration(generation: InsertImageGeneration & { userId?: string }): Promise<ImageGeneration> {
    const [imageGeneration] = await db
      .insert(imageGenerations)
      .values({
        prompt: generation.prompt,
        title: generation.title || null,
        musicGenerationId: generation.musicGenerationId || null,
        userId: generation.userId || null,
      })
      .returning();
    return imageGeneration;
  }

  async getImageGeneration(id: string): Promise<ImageGeneration | undefined> {
    const [imageGeneration] = await db
      .select()
      .from(imageGenerations)
      .where(eq(imageGenerations.id, id));
    return imageGeneration || undefined;
  }

  async updateImageGeneration(id: string, updates: Partial<ImageGeneration>): Promise<ImageGeneration | undefined> {
    const [updated] = await db
      .update(imageGenerations)
      .set(updates)
      .where(eq(imageGenerations.id, id))
      .returning();
    return updated || undefined;
  }

  async getUserImageGenerations(userId?: string, limit: number = 50): Promise<ImageGeneration[]> {
    if (userId) {
      return await db
        .select()
        .from(imageGenerations)
        .where(eq(imageGenerations.userId, userId))
        .orderBy(desc(imageGenerations.createdAt))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(imageGenerations)
      .orderBy(desc(imageGenerations.createdAt))
      .limit(limit);
  }
}

class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private music: MusicGeneration[] = [];
  private images: ImageGeneration[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }
  async createUser(user: InsertUser): Promise<User> {
    const u = { id: nanoid(), username: user.username, password: user.password } as User;
    this.users.push(u);
    return u;
  }

  async createMusicGeneration(g: InsertMusicGeneration & { userId?: string }): Promise<MusicGeneration> {
    const obj: MusicGeneration = {
      id: nanoid(),
      userId: g.userId ?? null as any,
      title: g.title ?? null as any,
      prompt: g.prompt,
      style: g.style ?? null as any,
      model: (g.model as any) ?? "V5",
      instrumental: g.instrumental ?? false,
      duration: g.duration ?? null as any,
      status: "pending",
      progress: 0,
      statusDetail: null as any,
      audioUrl: null as any,
      imageUrl: null as any,
      taskId: null as any,
      metadata: null as any,
      createdAt: new Date(),
      completedAt: null as any,
    };
    this.music.push(obj);
    return obj;
  }
  async getMusicGeneration(id: string): Promise<MusicGeneration | undefined> {
    return this.music.find(m => m.id === id);
  }
  async updateMusicGeneration(id: string, updates: Partial<MusicGeneration>): Promise<MusicGeneration | undefined> {
    const idx = this.music.findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    this.music[idx] = { ...this.music[idx], ...updates };
    return this.music[idx];
  }
  async getUserMusicGenerations(userId?: string, limit: number = 50): Promise<MusicGeneration[]> {
    const arr = userId ? this.music.filter(m => m.userId === userId) : this.music;
    return arr.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
  }

  async createImageGeneration(g: InsertImageGeneration & { userId?: string }): Promise<ImageGeneration> {
    const obj: ImageGeneration = {
      id: nanoid(),
      userId: g.userId ?? null as any,
      title: g.title ?? null as any,
      prompt: g.prompt,
      status: "pending",
      imageUrl: null as any,
      musicGenerationId: (g as any).musicGenerationId ?? null as any,
      createdAt: new Date(),
      completedAt: null as any,
    };
    this.images.push(obj);
    return obj;
  }
  async getImageGeneration(id: string): Promise<ImageGeneration | undefined> {
    return this.images.find(i => i.id === id);
  }
  async updateImageGeneration(id: string, updates: Partial<ImageGeneration>): Promise<ImageGeneration | undefined> {
    const idx = this.images.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    this.images[idx] = { ...this.images[idx], ...updates };
    return this.images[idx];
  }
  async getUserImageGenerations(userId?: string, limit: number = 50): Promise<ImageGeneration[]> {
    const arr = userId ? this.images.filter(i => i.userId === userId) : this.images;
    return arr.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
  }
}

export const storage: IStorage = db ? new DatabaseStorage() : new InMemoryStorage();
