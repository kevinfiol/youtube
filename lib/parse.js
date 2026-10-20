import { parse } from 'txml';
import { Innertube } from 'youtubei.js';
import { getRandomVideos } from './util.js';
import {
  MAX_VIDEOS_PER_CHANNEL,
  TIME_UNITS_MS,
  YEAR_IN_MS,
} from './constants.js';

const RELATIVE_DATE_REGEX = /(\d+)\s*(mo|[smhdwy])/;
const FEED_CHANNEL_ID_REGEX = /feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/;

export async function parseSubscriptions(subscriptions = [], randomPicks = 0) {
  const yt = await Innertube.create({ lang: 'en' });
  const videos = {};
  const channels = [];

  for (const sub of subscriptions) {
    try {
      let channelId = sub;

      if (sub.startsWith('@')) {
        let { payload } = await yt.resolveURL(`https://www.youtube.com/${sub}`);
        // some handles resolve to a legacy url first, e.g. `/c/name`
        if (!payload.browseId) ({ payload } = await yt.resolveURL(payload.url));
        channelId = payload.browseId;
      }

      const ytChannel = await yt.getChannel(channelId);
      const author = ytChannel.metadata.title;
      const channel = `https://www.youtube.com/channel/${channelId}`;
      channels.push({ id: channelId, name: author, url: channel });

      // uploads playlist (`UU...`) includes videos, shorts, and streams
      const { videos: latest } = await yt.getPlaylist(
        `UU${channelId.slice(2)}`,
      );

      for (const video of latest.slice(0, MAX_VIDEOS_PER_CHANNEL)) {
        // youtube only exposes relative dates here, e.g. `13h ago`
        const parts = video.metadata.metadata.metadata_rows.flatMap(
          (row) => row.metadata_parts ?? [],
        );
        const ago = parts.at(-1)?.text.text ?? '';
        const [, count, unit] = ago.match(RELATIVE_DATE_REGEX) ?? [];
        if (!unit) continue;

        const age = count * TIME_UNITS_MS[unit];
        // don't include videos more than a year old
        if (age >= YEAR_IN_MS) continue;

        const id = video.content_id;
        const pubDate = new Date(Date.now() - age);
        // group by youtube's relative date, e.g. `2d ago`; rebuilt so `Streamed 1mo ago` joins `1mo ago`
        const dateStr = ['s', 'm', 'h'].includes(unit)
          ? 'Published Today'
          : `${count}${unit} ago`;

        addVideo(videos, {
          title: video.metadata.title.text,
          author,
          pubDate,
          dateStr,
          link: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          channel,
        });
      }
    } catch (e) {
      console.error('Could not fetch videos for', sub, e);
    }
  }

  return finalize(videos, channels, randomPicks);
}

export async function parseRSSSubscriptions(
  subscriptions = [],
  randomPicks = 0,
) {
  const videos = {};
  const channels = [];

  for (const sub of subscriptions) {
    try {
      const channelId = await getChannelId(sub);
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      );
      if (!res.ok) throw Error(`feed returned ${res.status}`);

      const feed = parse(await res.text()).find((n) => n.tagName === 'feed');
      const author = getText(feed, 'title');
      const channel = `https://www.youtube.com/channel/${channelId}`;
      channels.push({ id: channelId, name: author, url: channel });

      for (const entry of getChildren(feed, 'entry')) {
        const pubDate = new Date(getText(entry, 'published'));
        // don't include videos more than a year old
        if (Date.now() - pubDate > YEAR_IN_MS) continue;

        const media = getChildren(entry, 'media:group')[0];

        addVideo(videos, {
          title: getText(entry, 'title'),
          author,
          pubDate,
          dateStr: getDateStr(pubDate),
          link: getChildren(entry, 'link')[0].attributes.href,
          thumbnail: getChildren(media, 'media:thumbnail')[0].attributes.url,
          channel,
        });
      }
    } catch (e) {
      console.error('Could not fetch feed for', sub, e);
    }
  }

  return finalize(videos, channels, randomPicks);
}

async function getChannelId(sub = '') {
  if (!sub.startsWith('@')) return sub;

  // channel pages link to their rss feed, which contains the channel id
  const res = await fetch(`https://www.youtube.com/${sub}`);
  const match = (await res.text()).match(FEED_CHANNEL_ID_REGEX);
  if (!match) throw Error('channel id not found');
  return match[1];
}

function getChildren(node, tagName) {
  return node.children.filter((child) => child.tagName === tagName);
}

function getText(node, tagName) {
  return getChildren(node, tagName)[0].children[0];
}

function addVideo(videos, video) {
  if (!videos[video.dateStr]) {
    videos[video.dateStr] = [];
  }

  videos[video.dateStr].push(video);
}

async function finalize(videos, channels, randomPicks) {
  const randomVideos = await getRandomVideos(
    channels.map((channel) => channel.id),
    randomPicks,
  );

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

function getDateStr(pubDate) {
  const month = pubDate.getMonth() + 1;
  const date = pubDate.getDate();
  const dateStr = `${pubDate.getFullYear()}.${
    month < 10 ? `0${month}` : month
  }.${date < 10 ? `0${date}` : date}`;
  return dateStr;
}
