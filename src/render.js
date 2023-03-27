import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Parser from 'rss-parser';
import { compile } from 'yeahjs';
import FEEDS from './feeds.json' assert { type: 'json' };

const TEST_FILE = resolve('./src/data.json');
const TEMPLATE_FILE = resolve('./src/template.html');
const OUTPUT_FILE = resolve('./dist/index.html');

const YOUTUBE_URL = 'yt.sheev.net';
const TIMEZONE_OFFSET = -4.0; // default to EST
const NOW = getNowDate(TIMEZONE_OFFSET);
const YEAR_IN_MS = 31536000000;

const FEED_CONTENT_TYPES = [
  'application/json',
  'application/atom+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

const PARSER = new Parser({
  customFields: {
    item: [
      ['media:group', 'group']
    ]
  }
});

export async function render(dev = false, write = false) {
  let videos = {};

  if (dev) {
    videos = JSON.parse(readFileSync(TEST_FILE, { encoding: 'utf8' }));
  } else {
    for (const [_channel, feed] of FEEDS) {
      try {
        const response = await fetch(feed, { method: 'GET' });
        const contentType = response.headers.get('content-type').split(';')[0]; // e.g., `application/xml; charset=utf-8` -> `application/xml`

        if (!FEED_CONTENT_TYPES.includes(contentType)) {
          // invalid content type
          continue;
        }

        const body = await response.text();
        const contents = typeof body === "string" ? await PARSER.parseString(body) : body;

        contents.items.forEach(item => {
          const pubDate = new Date(item.pubDate);
          const diffInMs = NOW - pubDate;

          // don't include videos more than a year old
          if (diffInMs > YEAR_IN_MS) return;

          const month = pubDate.getMonth() + 1;
          const date = pubDate.getDate();
          const dateStr = `${pubDate.getFullYear()}.${month < 10 ? `0${month}` : month}.${date < 10 ? `0${date}` : date}`;

          if (!videos[dateStr]) videos[dateStr] = [];

          videos[dateStr].push({
            ...item,
            dateStr,
            youtube: item.link + '&redirect=false', // query param to use with kevinfiol/redirector
            link: `https://${YOUTUBE_URL}` + item.link.split('youtube.com')[1], // redirect
            thumbnail: item.group['media:thumbnail'][0]['$'].url,
            channel: `https://${YOUTUBE_URL}` + contents.link.split('youtube.com')[1] // redirect
          });
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (write) writeFileSync(TEST_FILE, JSON.stringify(videos), 'utf8');
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

  const now = NOW.toString().split('(')[0].trim();

  // search url
  const searchUrl = `https://${YOUTUBE_URL}/search`;

  const source = readFileSync(TEMPLATE_FILE, { encoding: 'utf8' });
  const template = compile(source, { localsName: 'it' });
  const html = template({ videos, days, now, searchUrl });
  writeFileSync(OUTPUT_FILE, html, { encoding: 'utf8' });
}

function getNowDate(offset) {
  let d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  d = new Date(utc + (3600000 * offset));
  return d;
}
