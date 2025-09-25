import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseStringPromise } from 'xml2js';
import { template } from './template.js';
import { feeds } from './feeds.js';
import { MODES } from './modes.js';

const YT_RANDOM_URL = process.env.YT_RANDOM_URL;
const YT_RANDOM_USER = process.env.YT_RANDOM_USER;
const YT_RANDOM_PASSWORD = process.env.YT_RANDOM_PASSWORD;

const TEST_FILE = resolve('./src/data.json');
const OUTPUT_FILE = resolve('./dist/index.html');
const NEWPIPE_SUBSCRIPTIONS_OUTPUT = resolve('./dist/newpipe_subscriptions.json');

const TIMEZONE_OFFSET = -4.0; // default to EST
const NOW = getNowDate(TIMEZONE_OFFSET);
const YEAR_IN_MS = 31536000000;
const NO_OF_RANDOM_VIDEOS = 10;

const feedEntries = feeds.map((feed) =>
  Array.isArray(feed) ? feed : [feed.slice(1), feed]
);

const feedUrls = await Promise.all(
  feedEntries.map(async (entry) =>
    [entry[0], await getFeedUrl(entry[1])]
  )
);

export async function render({
  dev = false,
  write = false,
  mode = MODES.YOUTUBE,
  useEmbedUrls = false
} = {}) {
  let videos = {};
  let channelLinks = [];
  let randomVideos = [];

  const { domain, query, search } = URL_MODE[mode];

  if (dev) {
    const testData = JSON.parse(readFileSync(TEST_FILE, { encoding: 'utf8' }));
    videos = testData.videos;
    channelLinks = testData.channelLinks;
    randomVideos = testData.randomVideos;
  } else {
    // newpipe subs object
    const newpipe = {
      app_version: '4.7.2',
      app_version_int: 108500,
      subscriptions: []
    };

    // get at most 5 random channels to get random videos from
    const randomChannels = [];
    for (let i = 0; i < Math.min(feedUrls.length, NO_OF_RANDOM_VIDEOS); i++) {
      let channelId = '';

      do {
        const [_, feedUrl] = getRandom(feedUrls);
        const url = new URL(feedUrl);
        channelId = url.searchParams.get('channel_id');
      } while (randomChannels.includes(channelId))

      randomChannels.push(channelId);
    }

    randomVideos = await getRandomVideos(randomChannels);
    randomVideos = randomVideos.map((video) => ({
      ...video,
      link: `https://${domain}/watch?v=${video.id}`,
      channel: `https://${domain}/channel/${video.channelId}`
    }));

    for (const [channelName, feedUrl] of feedUrls) {
      try {
        const response = await fetch(feedUrl, { method: 'GET' });
        const contentType = response.headers.get('content-type').split(';')[0]; // e.g., `application/xml; charset=utf-8` -> `application/xml`

        if (!FEED_CONTENT_TYPES.includes(contentType)) {
          // invalid content type
          continue;
        }

        const body = await response.text();
        const { feed } = await parseStringPromise(body);

        const rawChannelUrl = feed.link[1]['$'].href;
        const channel = youtubeRedirect(rawChannelUrl, domain);
        channelLinks.push({ name: channelName, url: channel });

        // add newpipe sub
        newpipe.subscriptions.push({
          service_id: 0,
          url: rawChannelUrl,
          name: channelName
        });

        feed.entry.forEach(video => {
          const pubDate = new Date(video.published[0]);
          const diffInMs = NOW - pubDate;

          // don't include videos more than a year old
          if (diffInMs > YEAR_IN_MS) return;

          const title = video.title[0];
          const author = video.author[0].name[0];
          const thumbnail = video['media:group'][0]['media:thumbnail'][0]['$'].url;

          let link = youtubeRedirect(video.link[0]['$'].href, domain);
          if (mode === MODES.YOUTUBE && useEmbedUrls) {
            link = link.replace('watch?v=', 'embed/')
          }

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

    if (write) {
      const data = { videos, channelLinks, randomVideos };
      writeFileSync(TEST_FILE, JSON.stringify(data, null, 2), 'utf8');
    }

    writeFileSync(NEWPIPE_SUBSCRIPTIONS_OUTPUT, JSON.stringify(newpipe, null, 2), 'utf8');
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
  const html = template({ videos, days, searchUrl, query, channelLinks, randomVideos });
  writeFileSync(OUTPUT_FILE, html, { encoding: 'utf8' });
}

function getRandom(arr = []) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
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

async function getFeedUrl(part = '') {
  if (part.startsWith('http'))
    return part; // already a url

  if (part.startsWith('@')) {
    // channel alias
    try {
      const res = await fetch(`https://www.youtube.com/${part}`);
      const html = await res.text();
      const match = html.match(RSS_URL_REGEX);
      if (match) return match[1];
    } catch (_e) {
      console.error('Could not find feed for ', part);
    }

    return '';
  }

  // else it's a channelId
  return "https://www.youtube.com/feeds/videos.xml?channel_id=" + part;
}
