import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/history — paginated list of read articles sorted by readAt DESC
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    const userId = req.user!.id;

    // Split search into words; each word must appear in title (AND logic, case-insensitive)
    const titleConditions = search
      ? String(search).trim().split(/\s+/).map(word => ({
          feedItem: { title: { contains: word, mode: 'insensitive' as const } }
        }))
      : [];

    const readItems = await prisma.readStatus.findMany({
      where: {
        userId,
        isRead: true,
        feedItem: { feed: { userId } },
        AND: titleConditions,
      },
      include: {
        feedItem: {
          select: {
            id: true,
            title: true,
            link: true,
            pubDate: true,
            author: true,
            thumbnail: true,
            feed: { select: { id: true, title: true, categoryId: true } },
          },
        },
      },
      orderBy: { readAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const response = readItems.map(rs => ({
      id: rs.feedItem.id,
      title: rs.feedItem.title,
      link: rs.feedItem.link,
      pubDate: rs.feedItem.pubDate,
      author: rs.feedItem.author,
      thumbnail: rs.feedItem.thumbnail,
      feed: rs.feedItem.feed,
      readAt: rs.readAt,
      isRead: true,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/history/stats — read counts by time period
router.get('/stats', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Start of week: Monday
    const startOfWeek = new Date(now);
    const day = now.getDay();
    startOfWeek.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayOpened, weekOpened, monthOpened, allTimeOpened,
      todayRead, weekRead, monthRead, allTimeRead,
    ] = await Promise.all([
      prisma.readStatus.count({ where: { userId, openedAt: { gte: startOfToday } } }),
      prisma.readStatus.count({ where: { userId, openedAt: { gte: startOfWeek } } }),
      prisma.readStatus.count({ where: { userId, openedAt: { gte: startOfMonth } } }),
      prisma.readStatus.count({ where: { userId, openedAt: { not: null } } }),
      prisma.readStatus.count({ where: { userId, isRead: true, readAt: { gte: startOfToday } } }),
      prisma.readStatus.count({ where: { userId, isRead: true, readAt: { gte: startOfWeek } } }),
      prisma.readStatus.count({ where: { userId, isRead: true, readAt: { gte: startOfMonth } } }),
      prisma.readStatus.count({ where: { userId, isRead: true } }),
    ]);

    res.json({
      today: todayOpened,
      week: weekOpened,
      month: monthOpened,
      allTime: allTimeOpened,
      todayRead,
      weekRead,
      monthRead,
      allTimeRead,
    });
  } catch (error) {
    console.error('Error fetching history stats:', error);
    res.status(500).json({ error: 'Failed to fetch history stats' });
  }
});

export default router;
