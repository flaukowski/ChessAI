import { type User, type InsertUser, type MusicGeneration, type InsertMusicGeneration, type ImageGeneration, type InsertImageGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private musicGenerations: Map<string, MusicGeneration>;
  private imageGenerations: Map<string, ImageGeneration>;

  constructor() {
    this.users = new Map();
    this.musicGenerations = new Map();
    this.imageGenerations = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createMusicGeneration(generation: InsertMusicGeneration & { userId?: string }): Promise<MusicGeneration> {
    const id = randomUUID();
    const musicGeneration: MusicGeneration = {
      ...generation,
      id,
      userId: generation.userId || null,
      style: generation.style || null,
      title: generation.title || null,
      model: generation.model || "V5",
      instrumental: generation.instrumental ?? false,
      duration: generation.duration || null,
      status: "pending",
      audioUrl: null,
      imageUrl: null,
      taskId: null,
      metadata: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.musicGenerations.set(id, musicGeneration);
    return musicGeneration;
  }

  async getMusicGeneration(id: string): Promise<MusicGeneration | undefined> {
    return this.musicGenerations.get(id);
  }

  async updateMusicGeneration(id: string, updates: Partial<MusicGeneration>): Promise<MusicGeneration | undefined> {
    const existing = this.musicGenerations.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.musicGenerations.set(id, updated);
    return updated;
  }

  async getUserMusicGenerations(userId?: string, limit: number = 50): Promise<MusicGeneration[]> {
    const generations = Array.from(this.musicGenerations.values());
    const filtered = userId ? generations.filter(g => g.userId === userId) : generations;
    return filtered
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createImageGeneration(generation: InsertImageGeneration & { userId?: string }): Promise<ImageGeneration> {
    const id = randomUUID();
    const imageGeneration: ImageGeneration = {
      ...generation,
      id,
      userId: generation.userId || null,
      title: generation.title || null,
      musicGenerationId: generation.musicGenerationId || null,
      status: "pending",
      imageUrl: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.imageGenerations.set(id, imageGeneration);
    return imageGeneration;
  }

  async getImageGeneration(id: string): Promise<ImageGeneration | undefined> {
    return this.imageGenerations.get(id);
  }

  async updateImageGeneration(id: string, updates: Partial<ImageGeneration>): Promise<ImageGeneration | undefined> {
    const existing = this.imageGenerations.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.imageGenerations.set(id, updated);
    return updated;
  }

  async getUserImageGenerations(userId?: string, limit: number = 50): Promise<ImageGeneration[]> {
    const generations = Array.from(this.imageGenerations.values());
    const filtered = userId ? generations.filter(g => g.userId === userId) : generations;
    return filtered
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
