import { parseStringPromise } from 'npm:xml2js@0.6.2';
import { getRandomVideos } from './util.js';
import {
  FEED_CONTENT_TYPES,
  TIMEZONE_OFFSET,
  YEAR_IN_MS,
} from './constants.js';

const NOW = getNowDate(TIMEZONE_OFFSET);

export async function parseFeeds(feedUrls = [], randomPicks = 0) {
  const videos = {};
  const channels = [];
  const randomVideos = await getRandomVideos(feedUrls, randomPicks);

  for (const [channelName, feedUrl] of feedUrls) {
    try {
      const response = await fetch(feedUrl);
      const contentType = response.headers.get('content-type').split(';')[0]; // e.g., `application/xml; charset=utf-8` -> `application/xml`

      if (!FEED_CONTENT_TYPES.includes(contentType)) {
        continue;
      }

      const body = await response.text();
      const { feed } = await parseStringPromise(body);

      const channel = feed.link[1]['$'].href;
      channels.push({ name: channelName, url: channel });

      feed.entry.forEach((video) => {
        const pubDate = new Date(video.published[0]);
        // don't include videos more than a year old
        if ((NOW - pubDate) > YEAR_IN_MS) return;

        const title = video.title[0];
        const link = video.link[0]['$'].href;
        const author = video.author[0].name[0];
        const thumbnail =
          video['media:group'][0]['media:thumbnail'][0]['$'].url;
        const dateStr = getDateStr(pubDate);

        if (!videos[dateStr]) {
          videos[dateStr] = [];
        }

        videos[dateStr].push({
          title,
          author,
          pubDate,
          dateStr,
          link,
          thumbnail,
          channel,
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  // sort videos
  for (const day in videos) {
    videos[day].sort((a, b) => {
      return a.pubDate < b.pubDate ? 1 : -1;
    });
  }

  // sort channels
  channels.sort((a, b) => {
    return a.name > b.name ? 1 : -1;
  });

  return { videos, channels, randomVideos };
}

function getNowDate(offset) {
  let d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  d = new Date(utc + (3600000 * offset));
  return d;
}

function getDateStr(pubDate) {
  const month = pubDate.getMonth() + 1;
  const date = pubDate.getDate();
  const dateStr = `${pubDate.getFullYear()}.${
    month < 10 ? `0${month}` : month
  }.${date < 10 ? `0${date}` : date}`;
  return dateStr;
}
