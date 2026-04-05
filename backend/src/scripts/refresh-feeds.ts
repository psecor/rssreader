import { PrismaClient } from '@prisma/client';
import { updateFeed } from '../services/rssFeedService';

const prisma = new PrismaClient();

async function refreshAllFeeds() {
  try {
    console.log('Fetching all feeds...');
    const feeds = await prisma.feed.findMany({
      select: {
        id: true,
        title: true,
        url: true,
      },
    });

    console.log(`Found ${feeds.length} feed(s) to refresh\n`);

    for (const feed of feeds) {
      console.log(`Refreshing: ${feed.title} (${feed.url})`);
      const result = await updateFeed(feed.id);

      if (result.success) {
        console.log(`✓ Success! New items: ${result.newItemsCount}\n`);
      } else {
        console.log(`✗ Failed: ${result.error}\n`);
      }
    }

    console.log('All feeds refreshed!');
  } catch (error) {
    console.error('Error refreshing feeds:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

refreshAllFeeds();
