import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get feed items with filtering and pagination
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      feedId,
      categoryId,
      isRead,
      search,
      limit = '50',
      offset = '0',
    } = req.query;

    const where: any = {};

    // Filter by feed
    if (feedId) {
      where.feedId = parseInt(feedId as string);
      // Verify the feed belongs to the user
      const feed = await prisma.feed.findFirst({
        where: {
          id: where.feedId,
          userId: req.user!.id,
        },
      });
      if (!feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }
    }
    // Filter by category
    else if (categoryId) {
      const feeds = await prisma.feed.findMany({
        where: {
          categoryId: parseInt(categoryId as string),
          userId: req.user!.id,
        },
        select: { id: true },
      });
      where.feedId = { in: feeds.map((f) => f.id) };
    }
    // If no feedId or categoryId, ensure we only get items from user's feeds
    else {
      const userFeeds = await prisma.feed.findMany({
        where: {
          userId: req.user!.id,
        },
        select: { id: true },
      });
      where.feedId = { in: userFeeds.map((f) => f.id) };
    }

    // Build complex filters using AND array for multiple conditions
    const andConditions: any[] = [];

    // Search in title and description
    if (search && typeof search === 'string') {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by read status at database level
    if (isRead !== undefined) {
      const isReadBool = isRead === 'true';
      if (isReadBool) {
        // Want read items: must have readStatus entry with isRead = true
        andConditions.push({
          readStatus: {
            some: {
              userId: req.user!.id,
              isRead: true,
            },
          },
        });
      } else {
        // Want unread items: either no readStatus entry OR readStatus with isRead = false
        andConditions.push({
          OR: [
            {
              readStatus: {
                none: {
                  userId: req.user!.id,
                },
              },
            },
            {
              readStatus: {
                some: {
                  userId: req.user!.id,
                  isRead: false,
                },
              },
            },
          ],
        });
      }
    }

    // Combine AND conditions with the main where clause
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Get items
    const items = await prisma.feedItem.findMany({
      where,
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            categoryId: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
        readStatus: {
          where: {
            userId: req.user!.id,
          },
          select: {
            isRead: true,
            readAt: true,
          },
        },
      },
      orderBy: {
        pubDate: 'desc',
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const filteredItems = items;

    // Transform the response to flatten read status
    const response = filteredItems.map((item) => ({
      ...item,
      isRead: item.readStatus.length > 0 && item.readStatus[0].isRead,
      readAt: item.readStatus.length > 0 ? item.readStatus[0].readAt : null,
      readStatus: undefined,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching feed items:', error);
    res.status(500).json({ error: 'Failed to fetch feed items' });
  }
});

// Count feed items matching the same filters as GET / (no pagination cap)
router.get('/count', ensureAuthenticated, async (req, res) => {
  try {
    const { feedId, categoryId, isRead, search } = req.query;

    const where: any = {};

    if (feedId) {
      where.feedId = parseInt(feedId as string);
      const feed = await prisma.feed.findFirst({
        where: { id: where.feedId, userId: req.user!.id },
      });
      if (!feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }
    } else if (categoryId) {
      const feeds = await prisma.feed.findMany({
        where: {
          categoryId: parseInt(categoryId as string),
          userId: req.user!.id,
        },
        select: { id: true },
      });
      where.feedId = { in: feeds.map((f) => f.id) };
    } else {
      const userFeeds = await prisma.feed.findMany({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      where.feedId = { in: userFeeds.map((f) => f.id) };
    }

    const andConditions: any[] = [];

    if (search && typeof search === 'string') {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (isRead !== undefined) {
      const isReadBool = isRead === 'true';
      if (isReadBool) {
        andConditions.push({
          readStatus: {
            some: { userId: req.user!.id, isRead: true },
          },
        });
      } else {
        andConditions.push({
          OR: [
            {
              readStatus: { none: { userId: req.user!.id } },
            },
            {
              readStatus: {
                some: { userId: req.user!.id, isRead: false },
              },
            },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const count = await prisma.feedItem.count({ where });
    res.json({ count });
  } catch (error) {
    console.error('Error counting feed items:', error);
    res.status(500).json({ error: 'Failed to count feed items' });
  }
});

// Get a single feed item
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.feedItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            userId: true,
          },
        },
        readStatus: {
          where: {
            userId: req.user!.id,
          },
          select: {
            isRead: true,
            readAt: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Feed item not found' });
    }

    // Verify the item's feed belongs to the user
    if (item.feed.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const response = {
      ...item,
      isRead: item.readStatus.length > 0 && item.readStatus[0].isRead,
      readAt: item.readStatus.length > 0 ? item.readStatus[0].readAt : null,
      readStatus: undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching feed item:', error);
    res.status(500).json({ error: 'Failed to fetch feed item' });
  }
});

export default router;
