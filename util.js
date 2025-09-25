const RSS_URL_REGEX = /href="([^"]*https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=[^"]*)"/;
const YT_RANDOM_URL = Deno.env.get('YT_RANDOM_URL');
const YT_RANDOM_USER = Deno.env.get('YT_RANDOM_USER');
const YT_RANDOM_PASSWORD = Deno.env.get('YT_RANDOM_PASSWORD');

export async function getRandomVideos(channelIds = []) {
  if (!YT_RANDOM_URL || !YT_RANDOM_USER || !YT_RANDOM_PASSWORD) {
    console.warn('yt-random variables not configured. Skipping.');
    return [];
  }

  const videos = [];
  const credentials = btoa(`${YT_RANDOM_USER}:${YT_RANDOM_PASSWORD}`);

  for (const channelId of channelIds) {
    try {
      const query = new URLSearchParams({ channelId }).toString();

      const res = await fetch(YT_RANDOM_URL + '/random?' + query, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` }
      });

      const json = await res.json();
      if (json.error) throw Error(json.error);
      videos.push(json.data);
    } catch (e) {
      console.error(e);
    }
  }

  return videos;
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

export async function getFeedUrls(feeds = []) {
  // normalize `feeds`
  const feedEntries = feeds.map((feed) =>
    Array.isArray(feed) ? feed : [feed.slice(1), feed]
  );

  return await Promise.all(
    feedEntries.map(async (entry) =>
      [entry[0], await getFeedUrl(entry[1])]
    )
  );
}