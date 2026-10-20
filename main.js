import { readFile, writeFile } from 'node:fs/promises';
import JSONC from 'tiny-jsonc';
import { domainRedirect } from './lib/util.js';
import { template } from './lib/template.js';
import {
  DOMAIN_VARS,
  MODE,
  NEWPIPE_APP_VERSION,
  NEWPIPE_APP_VERSION_INT,
} from './lib/constants.js';
import { parseRSSSubscriptions, parseSubscriptions } from './lib/parse.js';

const TEST = process.argv.includes('--use-test-data');
const WRITE = process.argv.includes('--write-test-data');
const CACHE_FILE = 'cache.json';

const { subscriptions, ...config } = JSONC.parse(
  await readFile('settings.jsonc', 'utf-8'),
);

const data = {
  videos: {},
  channels: [],
  randomVideos: [],
};

if (TEST) {
  // use cached test data
  const cache = JSON.parse(await readFile(CACHE_FILE, 'utf-8'));
  data.videos = cache.videos || {};
  data.channels = cache.channels || [];
  data.randomVideos = cache.randomVideos || [];
} else {
  const parseFn =
    config.source === 'innertube' ? parseSubscriptions : parseRSSSubscriptions;

  const { videos, channels, randomVideos } = await parseFn(
    subscriptions,
    config.randomPicks,
  );

  const { domain } = DOMAIN_VARS[config.mode];
  const applyRedirect = config.mode !== MODE.YOUTUBE;

  if (config.buildNewpipeSubs) {
    const newPipeConfig = {
      app_version: NEWPIPE_APP_VERSION,
      app_version_int: NEWPIPE_APP_VERSION_INT,
      subscriptions: [],
    };

    for (const channel of channels) {
      newPipeConfig.subscriptions.push({
        service_id: 0,
        url: channel.url,
        name: channel.name,
      });
    }

    await writeFile(
      'dist/newpipe_subscriptions.json',
      JSON.stringify(newPipeConfig),
    );
  }

  if (applyRedirect) {
    channels.forEach((channel) => {
      channel.url = domainRedirect(channel.url, domain);
    });
  }

  if (config.useEmbedUrls || applyRedirect) {
    const allVideos = [...randomVideos];

    // get all video refs
    for (const day in videos) {
      for (const v of videos[day]) {
        allVideos.push(v);
      }
    }

    for (const video of allVideos) {
      if (applyRedirect) {
        video.link = domainRedirect(video.link, domain);
        video.channel = domainRedirect(video.channel, domain);
      }

      if (config.useEmbedUrls) {
        video.link = video.link.replace('watch?v=', 'embed/');
        video.link = video.link.replace('shorts/', 'embed/');
      }
    }
  }

  data.videos = videos;
  data.channels = channels;
  data.randomVideos = randomVideos;

  if (WRITE) {
    await writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  }
}

// get list of days, sorted by each day's newest video
const days = Object.keys(data.videos).sort((a, b) => {
  return data.videos[a][0].pubDate < data.videos[b][0].pubDate ? 1 : -1;
});

const { query } = DOMAIN_VARS[config.mode];
const searchUrl = `https://yt.sheev.net/`;

const html = template({
  ...data,
  days,
  searchUrl,
  query,
});

await writeFile('dist/index.html', html);
