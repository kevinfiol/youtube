import { feeds, config } from './feeds.js';
import { domainRedirect, getFeedUrls } from './lib/util.js';
import { template } from "./lib/template.js";
import { MODE, DOMAIN_VARS, NEWPIPE_APP_VERSION, NEWPIPE_APP_VERSION_INT } from './lib/constants.js';
import { parseFeeds } from "./lib/parse.js";

const TEST = Deno.args.includes('--use-test-data');
const WRITE = Deno.args.includes('--write-test-data');
const CACHE_FILE = 'cache.json';

const data = {
  videos: {},
  channels: [],
  randomVideos: []
};

if (TEST) {
  // use cached test data
  const cache = JSON.parse(await Deno.readTextFile(CACHE_FILE));
  data.videos = cache.videos || {};
  data.channels = cache.channels || [];
  data.randomVideos = cache.randomVideos || [];
} else {
  const feedUrls = await getFeedUrls(feeds);
  const { videos, channels, randomVideos } = await parseFeeds(feedUrls, config.randomPicks);
  const { domain } = DOMAIN_VARS[config.mode];
  const applyRedirect = config.mode !== MODE.YOUTUBE;

  if (config.buildNewpipeSubs) {
    const newPipeConfig = {
      app_version: NEWPIPE_APP_VERSION,
      app_version_int: NEWPIPE_APP_VERSION_INT,
      subscriptions: []
    };

    for (const channel of channels) {
      newPipeConfig.subscriptions.push({
        service_id: 0,
        url: channel.url,
        name: channel.name
      });
    }

    await Deno.writeTextFile('dist/newpipe_subscriptions.json', JSON.stringify(newPipeConfig))
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
        video.link = video.link.replace('watch?v=', 'embed/')
        video.link = video.link.replace('shorts/', 'embed/')
      }
    }
  }

  data.videos = videos;
  data.channels = channels;
  data.randomVideos = randomVideos;

  if (WRITE) {
    await Deno.writeTextFile(CACHE_FILE, JSON.stringify(data, null, 2));
  }
}

// get sorted list of days
const days = Object.keys(data.videos).sort((a, b) => {
  return a < b ? 1 : -1;
});

const { domain, search, query } = DOMAIN_VARS[config.mode];
const searchUrl = `https://${domain}/${search}`;

const html = template({
  ...data,
  days,
  searchUrl,
  query,
});

await Deno.writeTextFile('dist/index.html', html);
