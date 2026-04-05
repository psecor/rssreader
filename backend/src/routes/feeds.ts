import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';
import { fetchFeed, storeFeedItems, updateFeed } from '../services/rssFeedService';

const router = express.Router();
const prisma = new PrismaClient();

// Get all feeds for the current user
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { categoryId } = req.query;

    const where: any = { userId: req.user!.id };
    if (categoryId) {
      where.categoryId = parseInt(categoryId as string);
    }

    const feeds = await prisma.feed.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { title: 'asc' },
    });

    res.json(feeds);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// Get a single feed
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const feed = await prisma.feed.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
      include: {
        category: true,
      },
    });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    res.json(feed);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Create a new feed
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { url, categoryId, title } = req.body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ error: 'Feed URL is required' });
    }

    if (!categoryId) {
      return res.status(400).json({ error: 'Category ID is required' });
    }

    // Verify the category belongs to the user
    const category = await prisma.category.findFirst({
      where: {
        id: parseInt(categoryId),
        userId: req.user!.id,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Try to fetch the feed to validate the URL
    let feedTitle = title;
    let feedDescription = '';
    try {
      const items = await fetchFeed(url.trim());
      if (!feedTitle && items.length > 0) {
        // Extract title from first item's link domain if not provided
        const urlObj = new URL(url.trim());
        feedTitle = urlObj.hostname;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error('Feed validation error:', errorMessage);
      return res.status(400).json({
        error: `Invalid or unreachable RSS feed URL: ${errorMessage}`
      });
    }

    // Create the feed
    const feed = await prisma.feed.create({
      data: {
        url: url.trim(),
        title: feedTitle || 'Untitled Feed',
        description: feedDescription,
        categoryId: parseInt(categoryId),
        userId: req.user!.id,
      },
      include: {
        category: true,
      },
    });

    // Fetch initial items
    try {
      const items = await fetchFeed(url.trim());
      await storeFeedItems(feed.id, items);

      await prisma.feed.update({
        where: { id: feed.id },
        data: { lastFetchedAt: new Date() },
      });
    } catch (error) {
      console.error('Error fetching initial feed items:', error);
    }

    res.status(201).json(feed);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You have already added this feed' });
    }
    console.error('Error creating feed:', error);
    res.status(500).json({ error: 'Failed to create feed' });
  }
});

// Update a feed
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, categoryId } = req.body;

    // Verify the feed belongs to the user
    const feed = await prisma.feed.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
    });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (categoryId) {
      // Verify the category belongs to the user
      const category = await prisma.category.findFirst({
        where: {
          id: parseInt(categoryId),
          userId: req.user!.id,
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      updateData.categoryId = parseInt(categoryId);
    }

    const updated = await prisma.feed.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        category: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating feed:', error);
    res.status(500).json({ error: 'Failed to update feed' });
  }
});

// Delete a feed
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the feed belongs to the user
    const feed = await prisma.feed.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
    });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    await prisma.feed.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Feed deleted successfully' });
  } catch (error) {
    console.error('Error deleting feed:', error);
    res.status(500).json({ error: 'Failed to delete feed' });
  }
});

// Refresh all feeds for the user
router.post('/refresh-all', ensureAuthenticated, async (req, res) => {
  try {
    const feeds = await prisma.feed.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    });

    const results = await Promise.all(feeds.map(f => updateFeed(f.id)));
    const newItemsCount = results.reduce((sum, r) => sum + (r.newItemsCount || 0), 0);
    const errors = results.filter(r => !r.success).length;

    res.json({ message: 'Feeds refreshed', total: feeds.length, newItemsCount, errors });
  } catch (error) {
    console.error('Error refreshing all feeds:', error);
    res.status(500).json({ error: 'Failed to refresh feeds' });
  }
});

// Manually refresh a feed
router.post('/:id/refresh', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the feed belongs to the user
    const feed = await prisma.feed.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.id,
      },
    });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const result = await updateFeed(parseInt(id));

    if (result.success) {
      res.json({
        message: 'Feed refreshed successfully',
        newItemsCount: result.newItemsCount,
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error refreshing feed:', error);
    res.status(500).json({ error: 'Failed to refresh feed' });
  }
});

export default router;
