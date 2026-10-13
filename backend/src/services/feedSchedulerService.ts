import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { updateFeed } from './rssFeedService';

const prisma = new PrismaClient();

// Per-user unread-item cap. Items beyond this are auto-marked read (oldest first)
// at the end of each scheduler pass, so the backlog can never grow unboundedly.
const UNREAD_CAP = 1000;

let scheduledTask: cron.ScheduledTask | null = null;

// Mark the oldest excess unread items read when a user is above UNREAD_CAP.
// "Unread" matches the frontend definition: no ReadStatus row OR isRead=false.
// We bump updatedAt explicitly on both insert and conflict so mobile delta-sync
// picks the changes up (see AGENTS.md Gotcha #16).
async function trimUnreadForUser(userId: number, cap: number): Promise<number> {
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "FeedItem" fi
    JOIN "Feed" f ON fi."feedId" = f.id
    LEFT JOIN "ReadStatus" rs ON rs."feedItemId" = fi.id AND rs."userId" = ${userId}
    WHERE f."userId" = ${userId}
      AND (rs.id IS NULL OR rs."isRead" = false)
  `;
  const unreadCount = Number(count);
  if (unreadCount <= cap) return 0;
  const toTrim = unreadCount - cap;

  await prisma.$executeRaw`
    INSERT INTO "ReadStatus" ("feedItemId", "userId", "isRead", "readAt", "updatedAt")
    SELECT fi.id, ${userId}, true, NOW(), NOW()
    FROM "FeedItem" fi
    JOIN "Feed" f ON fi."feedId" = f.id
    LEFT JOIN "ReadStatus" rs ON rs."feedItemId" = fi.id AND rs."userId" = ${userId}
    WHERE f."userId" = ${userId}
      AND (rs.id IS NULL OR rs."isRead" = false)
    ORDER BY COALESCE(fi."pubDate", fi."createdAt") ASC
    LIMIT ${toTrim}
    ON CONFLICT ("feedItemId", "userId") DO UPDATE
      SET "isRead" = true, "readAt" = NOW(), "updatedAt" = NOW()
  `;
  return toTrim;
}

export async function updateAllFeeds(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting feed update job...`);

  try {
    const feeds = await prisma.feed.findMany({
      select: { id: true, url: true, title: true },
    });

    console.log(`Found ${feeds.length} feeds to update`);

    for (const feed of feeds) {
      console.log(`Updating feed: ${feed.title} (${feed.url})`);
      const result = await updateFeed(feed.id);

      if (result.success) {
        console.log(`✓ Successfully updated feed ${feed.title}. New items: ${result.newItemsCount}`);
      } else {
        console.error(`✗ Failed to update feed ${feed.title}: ${result.error}`);
      }
    }

    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    for (const user of users) {
      try {
        const trimmed = await trimUnreadForUser(user.id, UNREAD_CAP);
        if (trimmed > 0) {
          console.log(`✓ Auto-marked ${trimmed} oldest unread items read for ${user.email} (cap=${UNREAD_CAP})`);
        }
      } catch (error) {
        console.error(`✗ Failed to trim unread for ${user.email}:`, error);
      }
    }

    console.log(`[${new Date().toISOString()}] Feed update job completed`);
  } catch (error) {
    console.error('Error in updateAllFeeds:', error);
  }
}

export function startFeedScheduler(): void {
  if (scheduledTask) {
    console.log('Feed scheduler is already running');
    return;
  }

  // Run every 15 minutes
  scheduledTask = cron.schedule('*/15 * * * *', async () => {
    await updateAllFeeds();
  });

  console.log('Feed scheduler started (runs every 15 minutes)');

  // Run immediately on startup
  setTimeout(() => {
    updateAllFeeds();
  }, 5000); // Wait 5 seconds after server starts
}

export function stopFeedScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('Feed scheduler stopped');
  }
}
