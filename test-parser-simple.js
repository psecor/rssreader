const Parser = require('rss-parser');

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

async function test() {
  try {
    const feed = await parser.parseURL('http://bringatrailer.com/feed/');
    const item = feed.items[0];

    console.log('First item title:', item.title);
    console.log('\nmedia:content:', JSON.stringify(item['media:content'], null, 2));

    // Test extraction
    const mediaContent = Array.isArray(item['media:content'])
      ? item['media:content'][0]
      : item['media:content'];

    if (mediaContent && mediaContent.$ && mediaContent.$.url) {
      console.log('\n✓ SUCCESS! Thumbnail URL:', mediaContent.$.url);
    } else {
      console.log('\n✗ FAILED - No thumbnail found');
      console.log('mediaContent structure:', mediaContent);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
