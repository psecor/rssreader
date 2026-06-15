import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Delta-sync read endpoint: returns read-status rows for the current user,
// optionally filtered by `?since=<ISO>` (the client's last-sync cursor).
// Paginated with `limit` / `offset`. The Android client calls this on each
// background sync to pick up reads/unreads made elsewhere (e.g. web).
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { since, limit = '500', offset = '0' } = req.query;

    const where: any = { userId: req.user!.id };
    if (since && typeof since === 'string') {
      const parsed = new Date(since);
      if (!Number.isNaN(parsed.getTime())) {
        where.updatedAt = { gt: parsed };
      }
    }

    const rows = await prisma.readStatus.findMany({
      where,
      select: {
        feedItemId: true,
        isRead: true,
        readAt: true,
        openedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(rows);
  } catch (error) {
    console.error('Error fetching read-status deltas:', error);
    res.status(500).json({ error: 'Failed to fetch read statuses' });
  }
});

// Mark item(s) as read
router.post('/mark-read', ensureAuthenticated, async (req, res) => {
  try {
    const { feedItemIds, opened } = req.body;

    if (!Array.isArray(feedItemIds) || feedItemIds.length === 0) {
      return res.status(400).json({ error: 'feedItemIds array is required' });
    }

    // Verify all items belong to user's feeds
    const items = await prisma.feedItem.findMany({
      where: {
        id: { in: feedItemIds },
        feed: {
          userId: req.user!.id,
        },
      },
    });

    if (items.length !== feedItemIds.length) {
      return res.status(404).json({ error: 'One or more feed items not found' });
    }

    const now = new Date();

    // Create or update read status for each item
    const results = await Promise.all(
      feedItemIds.map((itemId) =>
        prisma.readStatus.upsert({
          where: {
            feedItemId_userId: {
              feedItemId: itemId,
              userId: req.user!.id,
            },
          },
          create: {
            feedItemId: itemId,
            userId: req.user!.id,
            isRead: true,
            readAt: now,
            openedAt: opened ? now : null,
          },
          update: {
            isRead: true,
            readAt: now,
            ...(opened ? { openedAt: now } : {}),
          },
        })
      )
    );

    res.json({ message: 'Items marked as read', count: results.length });
  } catch (error) {
    console.error('Error marking items as read:', error);
    res.status(500).json({ error: 'Failed to mark items as read' });
  }
});

// Mark item as unread
router.post('/mark-unread', ensureAuthenticated, async (req, res) => {
  try {
    const { feedItemId } = req.body;

    if (!feedItemId) {
      return res.status(400).json({ error: 'feedItemId is required' });
    }

    // Verify item belongs to user's feed
    const item = await prisma.feedItem.findFirst({
      where: {
        id: feedItemId,
        feed: {
          userId: req.user!.id,
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Feed item not found' });
    }

    await prisma.readStatus.upsert({
      where: {
        feedItemId_userId: {
          feedItemId,
          userId: req.user!.id,
        },
      },
      create: {
        feedItemId,
        userId: req.user!.id,
        isRead: false,
        readAt: null,
      },
      update: {
        isRead: false,
        readAt: null,
      },
    });

    res.json({ message: 'Item marked as unread' });
  } catch (error) {
    console.error('Error marking item as unread:', error);
    res.status(500).json({ error: 'Failed to mark item as unread' });
  }
});

// Mark all items in a feed as read
router.post('/mark-all-read', ensureAuthenticated, async (req, res) => {
  try {
    const { feedId, categoryId } = req.body;

    if (!feedId && !categoryId) {
      return res.status(400).json({ error: 'feedId or categoryId is required' });
    }

    let feedIds: number[] = [];

    if (feedId) {
      // Verify feed belongs to user
      const feed = await prisma.feed.findFirst({
        where: {
          id: feedId,
          userId: req.user!.id,
        },
      });

      if (!feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }

      feedIds = [feedId];
    } else if (categoryId) {
      // Get all feeds in category
      const feeds = await prisma.feed.findMany({
        where: {
          categoryId,
          userId: req.user!.id,
        },
        select: { id: true },
      });

      if (feeds.length === 0) {
        return res.status(404).json({ error: 'Category not found or has no feeds' });
      }

      feedIds = feeds.map((f) => f.id);
    }

    // Get all items in the feed(s)
    const items = await prisma.feedItem.findMany({
      where: {
        feedId: { in: feedIds },
      },
      select: { id: true },
    });

    // Mark all as read
    const results = await Promise.all(
      items.map((item) =>
        prisma.readStatus.upsert({
          where: {
            feedItemId_userId: {
              feedItemId: item.id,
              userId: req.user!.id,
            },
          },
          create: {
            feedItemId: item.id,
            userId: req.user!.id,
            isRead: true,
            readAt: new Date(),
          },
          update: {
            isRead: true,
            readAt: new Date(),
          },
        })
      )
    );

    res.json({ message: 'All items marked as read', count: results.length });
  } catch (error) {
    console.error('Error marking all items as read:', error);
    res.status(500).json({ error: 'Failed to mark all items as read' });
  }
});

export default router;
