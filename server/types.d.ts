/**
 * Global type declarations for the server
 */

import { User } from '../shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
      file?: {
        size: number;
        path: string;
        mimetype: string;
        originalname: string;
      };
    }
  }
}

export {};
