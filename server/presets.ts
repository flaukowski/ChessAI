/**
 * Presets API Routes
 * Handles user presets CRUD operations and sharing functionality
 */

import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { authenticateToken } from './auth';
import { insertPresetSchema, updatePresetSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// All preset routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/presets
 * Get all presets for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const presets = await storage.getUserPresets(userId);

    res.json({
      presets: presets.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        effectChain: p.effectChain,
        tags: p.tags,
        isPublic: p.isPublic,
        shareToken: p.isPublic ? p.shareToken : undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get presets error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch presets',
    });
  }
});

/**
 * GET /api/v1/presets/public
 * Get public presets from all users
 */
router.get('/public', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const presets = await storage.getPublicPresets(limit, offset);

    res.json({
      presets: presets.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        effectChain: p.effectChain,
        tags: p.tags,
        shareToken: p.shareToken,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        hasMore: presets.length === limit,
      },
    });
  } catch (error) {
    console.error('Get public presets error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch public presets',
    });
  }
});

/**
 * GET /api/v1/presets/shared/:shareToken
 * Get a preset by its share token (public access)
 */
router.get('/shared/:shareToken', async (req: Request, res: Response) => {
  try {
    const preset = await storage.getPresetByShareToken(req.params.shareToken);

    if (!preset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found or no longer shared',
      });
    }

    res.json({
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        effectChain: preset.effectChain,
        tags: preset.tags,
        createdAt: preset.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get shared preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch shared preset',
    });
  }
});

/**
 * GET /api/v1/presets/:id
 * Get a specific preset by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const preset = await storage.getPreset(req.params.id);

    if (!preset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    // Check ownership or if preset is public
    if (preset.userId !== userId && !preset.isPublic) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this preset',
      });
    }

    res.json({
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        effectChain: preset.effectChain,
        tags: preset.tags,
        isPublic: preset.isPublic,
        shareToken: preset.userId === userId ? preset.shareToken : undefined,
        isOwner: preset.userId === userId,
        createdAt: preset.createdAt.toISOString(),
        updatedAt: preset.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch preset',
    });
  }
});

/**
 * POST /api/v1/presets
 * Create a new preset
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Validate request body
    const validationResult = insertPresetSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid preset data',
        details: validationResult.error.errors,
      });
    }

    const presetData = validationResult.data;
    const preset = await storage.createPreset(userId, presetData);

    // Log the creation
    await storage.createAuditLog({
      userId,
      action: 'preset.create',
      resource: 'preset',
      resourceId: preset.id,
      metadata: { name: preset.name },
    });

    res.status(201).json({
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        effectChain: preset.effectChain,
        tags: preset.tags,
        isPublic: preset.isPublic,
        shareToken: preset.shareToken,
        createdAt: preset.createdAt.toISOString(),
        updatedAt: preset.updatedAt.toISOString(),
      },
      message: 'Preset created successfully',
    });
  } catch (error) {
    console.error('Create preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create preset',
    });
  }
});

/**
 * PUT /api/v1/presets/:id
 * Update an existing preset
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    // Check ownership
    const existingPreset = await storage.getPreset(presetId);
    if (!existingPreset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    if (existingPreset.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this preset',
      });
    }

    // Validate request body
    const validationResult = updatePresetSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid preset data',
        details: validationResult.error.errors,
      });
    }

    const updateData = validationResult.data;
    const preset = await storage.updatePreset(presetId, userId, updateData);

    if (!preset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    // Log the update
    await storage.createAuditLog({
      userId,
      action: 'preset.update',
      resource: 'preset',
      resourceId: preset.id,
      changes: updateData,
    });

    res.json({
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        effectChain: preset.effectChain,
        tags: preset.tags,
        isPublic: preset.isPublic,
        shareToken: preset.shareToken,
        createdAt: preset.createdAt.toISOString(),
        updatedAt: preset.updatedAt.toISOString(),
      },
      message: 'Preset updated successfully',
    });
  } catch (error) {
    console.error('Update preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to update preset',
    });
  }
});

/**
 * DELETE /api/v1/presets/:id
 * Delete a preset
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;

    // Check ownership before deletion
    const existingPreset = await storage.getPreset(presetId);
    if (!existingPreset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    if (existingPreset.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this preset',
      });
    }

    const success = await storage.deletePreset(presetId, userId);

    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    // Log the deletion
    await storage.createAuditLog({
      userId,
      action: 'preset.delete',
      resource: 'preset',
      resourceId: presetId,
      metadata: { name: existingPreset.name },
    });

    res.json({
      success: true,
      message: 'Preset deleted successfully',
    });
  } catch (error) {
    console.error('Delete preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to delete preset',
    });
  }
});

/**
 * POST /api/v1/presets/:id/duplicate
 * Duplicate an existing preset (including public presets from other users)
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const presetId = req.params.id;
    const { name } = req.body;

    const sourcePreset = await storage.getPreset(presetId);

    if (!sourcePreset) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Preset not found',
      });
    }

    // Allow duplication if owned or if public
    if (sourcePreset.userId !== userId && !sourcePreset.isPublic) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this preset',
      });
    }

    const newPreset = await storage.createPreset(userId, {
      name: name || `${sourcePreset.name} (Copy)`,
      description: sourcePreset.description || undefined,
      effectChain: sourcePreset.effectChain as any[],
      tags: sourcePreset.tags || undefined,
      isPublic: false, // Duplicates are private by default
    });

    // Log the duplication
    await storage.createAuditLog({
      userId,
      action: 'preset.duplicate',
      resource: 'preset',
      resourceId: newPreset.id,
      metadata: { sourceId: presetId, sourceName: sourcePreset.name },
    });

    res.status(201).json({
      preset: {
        id: newPreset.id,
        name: newPreset.name,
        description: newPreset.description,
        effectChain: newPreset.effectChain,
        tags: newPreset.tags,
        isPublic: newPreset.isPublic,
        shareToken: newPreset.shareToken,
        createdAt: newPreset.createdAt.toISOString(),
        updatedAt: newPreset.updatedAt.toISOString(),
      },
      message: 'Preset duplicated successfully',
    });
  } catch (error) {
    console.error('Duplicate preset error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to duplicate preset',
    });
  }
});

export default router;
