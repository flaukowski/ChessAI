import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { authenticateToken } from './auth';
import { insertRecordingSchema, updateRecordingSchema } from '@shared/schema';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'recordings');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

// Get user's recordings
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const recordings = await storage.getUserRecordings(userId);
    res.json(recordings);
  } catch (error) {
    console.error('Get recordings error:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// Get public recordings (community)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const recordings = await storage.getPublicRecordings(limit, offset);

    // Don't expose userId for privacy, but include user info
    const sanitizedRecordings = recordings.map(r => ({
      ...r,
      userId: undefined,
    }));

    res.json(sanitizedRecordings);
  } catch (error) {
    console.error('Get public recordings error:', error);
    res.status(500).json({ error: 'Failed to fetch public recordings' });
  }
});

// Get recording by share token (for sharing private recordings)
router.get('/share/:token', async (req: Request, res: Response) => {
  try {
    const recording = await storage.getRecordingByShareToken(req.params.token);
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Increment play count
    await storage.incrementPlayCount(recording.id);

    res.json({
      ...recording,
      userId: undefined, // Don't expose userId
    });
  } catch (error) {
    console.error('Get shared recording error:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// Get single recording
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const recording = await storage.getRecording(req.params.id);

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Only allow access if user owns it or it's public
    if (recording.userId !== userId && !recording.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(recording);
  } catch (error) {
    console.error('Get recording error:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// Create new recording
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const validation = insertRecordingSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid recording data',
        details: validation.error.errors
      });
    }

    const recording = await storage.createRecording(userId, validation.data);
    res.status(201).json(recording);
  } catch (error) {
    console.error('Create recording error:', error);
    res.status(500).json({ error: 'Failed to create recording' });
  }
});

// Upload recording file (base64 encoded audio data)
router.post('/upload', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { audioData, format, title, description, duration, effectChain, settings } = req.body;

    if (!audioData || !format || !title || !duration) {
      return res.status(400).json({ error: 'Missing required fields: audioData, format, title, duration' });
    }

    // Validate format
    if (!['wav', 'mp3', 'ogg'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported: wav, mp3, ogg' });
    }

    // Decode base64 audio data
    const buffer = Buffer.from(audioData, 'base64');
    const fileSize = buffer.length;

    // Generate unique filename
    const filename = `${nanoid()}.${format}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Write file
    await fs.writeFile(filePath, buffer);

    // Create recording entry
    const recording = await storage.createRecording(userId, {
      title,
      description,
      duration: Math.round(duration),
      fileSize,
      fileUrl: `/uploads/recordings/${filename}`,
      format,
      sampleRate: 48000, // Default sample rate from pedalboard engine
      channels: 2, // Stereo
      effectChain,
      settings,
      isPublic: false,
    });

    res.status(201).json(recording);
  } catch (error) {
    console.error('Upload recording error:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

// Update recording
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const validation = updateRecordingSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid update data',
        details: validation.error.errors
      });
    }

    const recording = await storage.updateRecording(req.params.id, userId, validation.data);

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found or access denied' });
    }

    res.json(recording);
  } catch (error) {
    console.error('Update recording error:', error);
    res.status(500).json({ error: 'Failed to update recording' });
  }
});

// Toggle recording public/private
router.post('/:id/toggle-public', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const recording = await storage.toggleRecordingPublic(req.params.id, userId);

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found or access denied' });
    }

    res.json(recording);
  } catch (error) {
    console.error('Toggle recording public error:', error);
    res.status(500).json({ error: 'Failed to toggle recording visibility' });
  }
});

// Delete recording
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get recording first to delete file
    const recording = await storage.getRecording(req.params.id);
    if (recording && recording.userId === userId && recording.fileUrl) {
      try {
        const filePath = path.join(process.cwd(), recording.fileUrl);
        await fs.unlink(filePath);
      } catch (e) {
        // Ignore file deletion errors
      }
    }

    const success = await storage.deleteRecording(req.params.id, userId);

    if (!success) {
      return res.status(404).json({ error: 'Recording not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete recording error:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Increment play count (for analytics)
router.post('/:id/play', async (req: Request, res: Response) => {
  try {
    await storage.incrementPlayCount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Increment play count error:', error);
    res.status(500).json({ error: 'Failed to update play count' });
  }
});

export default router;
