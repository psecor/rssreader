import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { updateFeed } from './rssFeedService';

const prisma = new PrismaClient();

let scheduledTask: cron.ScheduledTask | null = null;

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
