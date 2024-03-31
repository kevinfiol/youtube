import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseStringPromise } from 'xml2js';
import { template } from './template.js';
import { feeds } from './feeds.js';
import { MODES } from './modes.js';

const TEST_FILE = resolve('./src/data.json');
const OUTPUT_FILE = resolve('./dist/index.html');

const YOUTUBE_URL = 'tube.sheev.net';
const TIMEZONE_OFFSET = -4.0; // default to EST
const NOW = getNowDate(TIMEZONE_OFFSET);
const YEAR_IN_MS = 31536000000;

const URL = {
  [MODES.INVIDIOUS]: { domain: 'yt.sheev.net', query: 'q', search: 'search' },
  [MODES.LIGHTTUBE]: { domain: 'tube.sheev.net', query: 'search_query', search: 'results' },
  [MODES.YOUTUBE]: { domain: 'youtube.com', query: 'search_query', search: 'results' }
};

const FEED_CONTENT_TYPES = [
  'application/atom+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

export async function render({ dev = false, write = false, mode = MODES.YOUTUBE } = {}) {
  let videos = {};
  let channelLinks = [];
  const { domain, query, search } = URL[mode];

  if (dev) {
    const testData = JSON.parse(readFileSync(TEST_FILE, { encoding: 'utf8' }));
    videos = testData.videos;
    channelLinks = testData.channelLinks;
  } else {
    for (const [channelName, feedUrl] of feeds) {
      try {
        const response = await fetch(feedUrl, { method: 'GET' });
        const contentType = response.headers.get('content-type').split(';')[0]; // e.g., `application/xml; charset=utf-8` -> `application/xml`

        if (!FEED_CONTENT_TYPES.includes(contentType)) {
          // invalid content type
          continue;
        }

        const body = await response.text();
        const { feed } = await parseStringPromise(body);

        const channel = youtubeRedirect(feed.link[1]['$'].href, domain);
        channelLinks.push({ name: channelName, url: channel });

        feed.entry.forEach(video => {
          const pubDate = new Date(video.published[0]);
          const diffInMs = NOW - pubDate;

          // don't include videos more than a year old
          if (diffInMs > YEAR_IN_MS) return;

          const title = video.title[0];
          const author = video.author[0].name[0];
          const link = youtubeRedirect(video.link[0]['$'].href, domain);
          const thumbnail = video['media:group'][0]['media:thumbnail'][0]['$'].url;

          const month = pubDate.getMonth() + 1;
          const date = pubDate.getDate();
          const dateStr = `${pubDate.getFullYear()}.${month < 10 ? `0${month}` : month}.${date < 10 ? `0${date}` : date}`;

          if (!videos[dateStr]) videos[dateStr] = [];

          videos[dateStr].push({
            title,
            author,
            pubDate,
            dateStr,
            link,
            thumbnail,
            channel
          });
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (write) writeFileSync(TEST_FILE, JSON.stringify({ videos, channelLinks }, null, 2), 'utf8');
  }

  for (let day in videos) {
    // sort videos per day by pubDate
    videos[day].sort((a, b) => {
      return a.pubDate < b.pubDate ? 1 : -1;
    });
  }

  // get a sorted list of days
  const days = Object.keys(videos).sort((a, b) => {
    return a < b ? 1 : -1;
  });

  // sort channel links
  channelLinks = channelLinks.sort((a, b) =>
    a.name > b.name ? 1 : -1
  );

  const searchUrl = `https://${domain}/${search}`;
  const html = template({ videos, days, searchUrl, query, channelLinks });
  writeFileSync(OUTPUT_FILE, html, { encoding: 'utf8' });
}

function getNowDate(offset) {
  let d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  d = new Date(utc + (3600000 * offset));
  return d;
}

// converts a youtube URL to its equivalent redirect; for use with invidious/Piped/etc.
function youtubeRedirect(link, redirectUrl) {
  return `https://${redirectUrl}` + link.split('youtube.com')[1];
}
