import { 
  users,
  userAISettings,
  emailVerificationTokens,
  passwordResetTokens,
  refreshTokens,
  type User, 
  type InsertUser,
  type UserAISettings,
  type InsertAISettings,
  type UpdateAISettings,
  type EmailVerificationToken,
  type PasswordResetToken,
  type RefreshToken,
} from "@shared/schema";
import { db } from "./db";
import { nanoid } from "nanoid";
import { eq, and, gt, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Email verification tokens
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationTokensForUser(userId: string): Promise<void>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetTokensForUser(userId: string): Promise<void>;
  
  // Refresh tokens
  createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  deleteRefreshToken(token: string): Promise<void>;
  deleteRefreshTokensForUser(userId: string): Promise<void>;
  
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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Email verification tokens
  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken> {
    const [verificationToken] = await db
      .insert(emailVerificationTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return verificationToken;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [verificationToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(and(
        eq(emailVerificationTokens.token, token),
        gt(emailVerificationTokens.expiresAt, new Date())
      ));
    return verificationToken || undefined;
  }

  async deleteEmailVerificationTokensForUser(userId: string): Promise<void> {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  }

  // Password reset tokens
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date())
      ));
    return resetToken || undefined;
  }

  async deletePasswordResetTokensForUser(userId: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }

  // Refresh tokens
  async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const [refreshToken] = await db
      .insert(refreshTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return refreshToken;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, token),
        gt(refreshTokens.expiresAt, new Date())
      ));
    return refreshToken || undefined;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
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
  private emailVerificationTokens: EmailVerificationToken[] = [];
  private passwordResetTokens: PasswordResetToken[] = [];
  private refreshTokens: RefreshToken[] = [];

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
    const u: User = { 
      id: nanoid(), 
      username: user.username, 
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(u);
    return u;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.users[idx] = { ...this.users[idx], ...updates, updatedAt: new Date() };
    return this.users[idx];
  }

  // Email verification tokens
  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken> {
    const t: EmailVerificationToken = { id: nanoid(), userId, token, expiresAt, createdAt: new Date() };
    this.emailVerificationTokens.push(t);
    return t;
  }
  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    return this.emailVerificationTokens.find(t => t.token === token && t.expiresAt > new Date());
  }
  async deleteEmailVerificationTokensForUser(userId: string): Promise<void> {
    this.emailVerificationTokens = this.emailVerificationTokens.filter(t => t.userId !== userId);
  }

  // Password reset tokens
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const t: PasswordResetToken = { id: nanoid(), userId, token, expiresAt, createdAt: new Date() };
    this.passwordResetTokens.push(t);
    return t;
  }
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.find(t => t.token === token && t.expiresAt > new Date());
  }
  async deletePasswordResetTokensForUser(userId: string): Promise<void> {
    this.passwordResetTokens = this.passwordResetTokens.filter(t => t.userId !== userId);
  }

  // Refresh tokens
  async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const t: RefreshToken = { id: nanoid(), userId, token, expiresAt, createdAt: new Date() };
    this.refreshTokens.push(t);
    return t;
  }
  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    return this.refreshTokens.find(t => t.token === token && t.expiresAt > new Date());
  }
  async deleteRefreshToken(token: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
  }
  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter(t => t.userId !== userId);
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
