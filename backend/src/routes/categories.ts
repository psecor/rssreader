import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all categories for the current user
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      include: {
        feeds: {
          select: {
            id: true,
            title: true,
            url: true,
            lastFetchedAt: true,
            lastFetchError: true,
            items: {
              where: {
                OR: [
                  { readStatus: { none: { userId: req.user!.id } } },
                  { readStatus: { some: { userId: req.user!.id, isRead: false } } }
                ]
              },
              select: { id: true }
            }
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform the response to include unread counts
    const response = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      userId: cat.userId,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      feeds: cat.feeds.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        lastFetchedAt: feed.lastFetchedAt,
        lastFetchError: feed.lastFetchError,
        unreadCount: feed.items.length
      }))
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get index view with unread counts
router.get('/index', ensureAuthenticated, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      include: {
        feeds: {
          select: {
            id: true,
            title: true,
            url: true,
            lastFetchedAt: true,
            items: {
              where: {
                OR: [
                  { readStatus: { none: { userId: req.user!.id } } },
                  { readStatus: { some: { userId: req.user!.id, isRead: false } } }
                ]
              },
              select: { id: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const response = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      feeds: cat.feeds.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        lastFetchedAt: feed.lastFetchedAt,
        unreadCount: feed.items.length
      }))
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching index:', error);
    res.status(500).json({ error: 'Failed to fetch index' });
  }
});

// Create a new category
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        userId: req.user!.id,
      },
    });

    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update a category
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Verify the category belongs to the user
    const category = await prisma.category.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.category.update({
      where: { id: parseInt(id) },
      data: { name: name.trim() },
    });

    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete a category
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the category belongs to the user
    const category = await prisma.category.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.category.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
