import { 
  users,
  userAISettings,
  type User, 
  type InsertUser,
  type UserAISettings,
  type InsertAISettings,
  type UpdateAISettings,
} from "@shared/schema";
import { db } from "./db";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // AI Settings for optional LLM integration
  getAISettings(userId: string): Promise<UserAISettings | undefined>;
  createAISettings(settings: InsertAISettings): Promise<UserAISettings>;
  updateAISettings(userId: string, updates: UpdateAISettings): Promise<UserAISettings | undefined>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAISettings(userId: string): Promise<UserAISettings | undefined> {
    const [settings] = await db
      .select()
      .from(userAISettings)
      .where(eq(userAISettings.userId, userId));
    return settings || undefined;
  }

  async createAISettings(settings: InsertAISettings): Promise<UserAISettings> {
    const [aiSettings] = await db
      .insert(userAISettings)
      .values(settings)
      .returning();
    return aiSettings;
  }

  async updateAISettings(userId: string, updates: UpdateAISettings): Promise<UserAISettings | undefined> {
    const [updated] = await db
      .update(userAISettings)
      .set(updates)
      .where(eq(userAISettings.userId, userId))
      .returning();
    return updated || undefined;
  }
}

class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private aiSettings: UserAISettings[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }
  async createUser(user: InsertUser): Promise<User> {
    const u = { 
      id: nanoid(), 
      username: user.username, 
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password 
    } as User;
    this.users.push(u);
    return u;
  }

  async getAISettings(userId: string): Promise<UserAISettings | undefined> {
    return this.aiSettings.find(s => s.userId === userId);
  }

  async createAISettings(settings: InsertAISettings): Promise<UserAISettings> {
    const s: UserAISettings = {
      id: nanoid(),
      userId: settings.userId,
      provider: settings.provider || "none",
      apiKey: settings.apiKey || null,
      baseUrl: settings.baseUrl || null,
      model: settings.model || null,
      settings: settings.settings || null,
    };
    this.aiSettings.push(s);
    return s;
  }

  async updateAISettings(userId: string, updates: UpdateAISettings): Promise<UserAISettings | undefined> {
    const idx = this.aiSettings.findIndex(s => s.userId === userId);
    if (idx === -1) return undefined;
    this.aiSettings[idx] = { ...this.aiSettings[idx], ...updates } as UserAISettings;
    return this.aiSettings[idx];
  }
}

export const storage: IStorage = db ? new DatabaseStorage() : new InMemoryStorage();
