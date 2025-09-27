const RSS_URL_REGEX =
  /href="([^"]*https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=[^"]*)"/;
const YT_RANDOM_URL = Deno.env.get('YT_RANDOM_URL');
const YT_RANDOM_USER = Deno.env.get('YT_RANDOM_USER');
const YT_RANDOM_PASSWORD = Deno.env.get('YT_RANDOM_PASSWORD');

function getRandom(arr = []) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

export async function getRandomVideos(feedUrls = [], randomPicks = 0) {
  if (randomPicks === 0) return [];

  if (!YT_RANDOM_URL || !YT_RANDOM_USER || !YT_RANDOM_PASSWORD) {
    console.warn('yt-random variables not configured. Skipping.');
    return [];
  }

  // first pick random channels
  const randomChannels = [];
  for (let i = 0; i < Math.min(feedUrls.length, randomPicks); i++) {
    let channelId = '';

    do {
      const [_, feedUrl] = getRandom(feedUrls);
      const url = new URL(feedUrl);
      channelId = url.searchParams.get('channel_id');
    } while (randomChannels.includes(channelId));

    randomChannels.push(channelId);
  }

  const credentials = btoa(`${YT_RANDOM_USER}:${YT_RANDOM_PASSWORD}`);

  // Create all fetch promises in parallel
  const fetchPromises = randomChannels.map(async (channelId) => {
    try {
      const query = new URLSearchParams({ channelId }).toString();

      const res = await fetch(YT_RANDOM_URL + '/random?' + query, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      const json = await res.json();
      if (json.error) throw Error(json.error);
      return json.data;
    } catch (e) {
      console.error(e);
      return null; // Return null for failed requests
    }
  });

  const results = await Promise.all(fetchPromises);
  // Filter out null results (failed requests)
  const videos = results.filter((video) => video !== null);

  // normalize data
  return videos.map((video) => ({
    ...video,
    link: `https://youtube.com/watch?v=${video.id}`,
    channel: `https://youtube.com/channel/${video.channelId}`,
  }));
}

async function getFeedUrl(part = '') {
  if (part.startsWith('http')) {
    return part; // already a url
  }

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
  return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + part;
}

export async function getFeedUrls(feeds = []) {
  // normalize `feeds`
  const feedEntries = feeds.map((feed) =>
    Array.isArray(feed) ? feed : [feed.slice(1), feed]
  );

  return await Promise.all(
    feedEntries.map(async (entry) => [entry[0], await getFeedUrl(entry[1])]),
  );
}

export function domainRedirect(link, domain) {
  return `https://${domain}` + link.split('youtube.com')[1];
}
