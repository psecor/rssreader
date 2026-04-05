const Parser = require('rss-parser');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
    ],
  },
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
  },
});

async function testFeed() {
  console.log('Testing FT RSS feed...\n');

  const urls = [
    'http://www.ft.com/rss/home/us',
    'https://www.ft.com/rss/home/us',
  ];

  for (const url of urls) {
    console.log(`Trying: ${url}`);
    try {
      const feed = await parser.parseURL(url);
      console.log('✓ SUCCESS!');
      console.log('  Feed title:', feed.title);
      console.log('  Items found:', feed.items.length);
      if (feed.items.length > 0) {
        console.log('  First item:', feed.items[0].title);
      }
      console.log();
      process.exit(0);
    } catch (error) {
      console.log('✗ FAILED:', error.message);
      console.log();
    }
  }

  console.log('All attempts failed.');
  process.exit(1);
}

testFeed();
