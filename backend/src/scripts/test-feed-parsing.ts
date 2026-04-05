import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['media:group', 'media:group'],
    ],
  },
});

async function testFeedParsing() {
  const url = 'http://bringatrailer.com/feed/';

  try {
    console.log(`Fetching feed: ${url}\n`);
    const feed = await parser.parseURL(url);

    console.log('Feed title:', feed.title);
    console.log('Total items:', feed.items.length);
    console.log('\n=== First Item Analysis ===\n');

    const item: any = feed.items[0];
    console.log('Title:', item.title);
    console.log('\nAvailable fields:');
    console.log(Object.keys(item).join(', '));

    console.log('\n--- Checking image fields ---');
    console.log('enclosure:', JSON.stringify(item.enclosure, null, 2));
    console.log('media:content:', JSON.stringify(item['media:content'], null, 2));
    console.log('media:thumbnail:', JSON.stringify(item['media:thumbnail'], null, 2));
    console.log('itunes.image:', item.itunes?.image);

    console.log('\n--- Content sample ---');
    const content = item.content || item['content:encoded'] || '';
    const contentPreview = content.substring(0, 500);
    console.log(contentPreview);

    // Try to extract image from content
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      console.log('\n✓ Found image in content:', imgMatch[1]);
    } else {
      console.log('\n✗ No image found in content');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testFeedParsing();
