import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';
import { safeFetchText } from './safeFetch';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['media:group', 'media:group'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});
const prisma = new PrismaClient();

export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  contentHtml?: string;
  author?: string;
  pubDate?: Date;
  guid: string;
  thumbnail?: string;
}

function extractThumbnail(item: any): string | undefined {
  // Try image enclosure
  if (item.enclosure?.url && item.enclosure?.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // Try media:content (can be object or array)
  if (item['media:content']) {
    const mediaContent = Array.isArray(item['media:content'])
      ? item['media:content'][0]
      : item['media:content'];

    if (mediaContent?.$?.url) {
      return mediaContent.$.url;
    }
  }

  // Try media:thumbnail (can be object or array)
  if (item['media:thumbnail']) {
    const mediaThumbnail = Array.isArray(item['media:thumbnail'])
      ? item['media:thumbnail'][0]
      : item['media:thumbnail'];

    if (mediaThumbnail?.$?.url) {
      return mediaThumbnail.$.url;
    }
  }

  // Try itunes:image
  if (item.itunes?.image) {
    return item.itunes.image;
  }

  // Try to extract first image from content
  if (item.content || item['content:encoded']) {
    const content = item.content || item['content:encoded'];
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return undefined;
}

export async function fetchFeed(url: string): Promise<RSSItem[]> {
  try {
    // safeFetchText applies SSRF protections (scheme allowlist, private-IP
    // blocklist re-checked per redirect, size + timeout + redirect caps) that
    // rss-parser's built-in parseURL doesn't. Hand the XML string to parseString.
    const xml = await safeFetchText(url);
    const feed = await parser.parseString(xml);

    const items: RSSItem[] = feed.items.map((item: any) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      description: item.contentSnippet || item.summary || '',
      contentHtml: item.content || item['content:encoded'] || '',
      author: item.creator || item.author || undefined,
      pubDate: item.pubDate ? new Date(item.pubDate) : undefined,
      guid: item.guid || item.link || `${item.title}-${item.pubDate}`,
      thumbnail: extractThumbnail(item),
    }));

    return items;
  } catch (error) {
    console.error(`Error fetching feed ${url}:`, error);
    throw error;
  }
}

export async function storeFeedItems(feedId: number, items: RSSItem[]): Promise<number> {
  let newItemsCount = 0;

  for (const item of items) {
    try {
      // Use upsert to avoid duplicates based on feedId + guid
      const result = await prisma.feedItem.upsert({
        where: {
          feedId_guid: {
            feedId,
            guid: item.guid,
          },
        },
        create: {
          feedId,
          title: item.title,
          link: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          author: item.author,
          pubDate: item.pubDate,
          guid: item.guid,
          thumbnail: item.thumbnail,
        },
        update: {
          // Update fields in case the content changed
          title: item.title,
          link: item.link,
          description: item.description,
          contentHtml: item.contentHtml,
          author: item.author,
          pubDate: item.pubDate,
          thumbnail: item.thumbnail,
        },
      });

      // If it was created (not updated), increment counter
      if (result.createdAt.getTime() === new Date().getTime()) {
        newItemsCount++;
      }
    } catch (error) {
      console.error(`Error storing feed item ${item.guid}:`, error);
      // Continue with next item even if one fails
    }
  }

  return newItemsCount;
}

export async function updateFeed(feedId: number): Promise<{ success: boolean; error?: string; newItemsCount?: number }> {
  try {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      return { success: false, error: 'Feed not found' };
    }

    const items = await fetchFeed(feed.url);
    const newItemsCount = await storeFeedItems(feedId, items);

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastFetchedAt: new Date(),
        lastFetchError: null,
      },
    });

    return { success: true, newItemsCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastFetchedAt: new Date(),
        lastFetchError: errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}
