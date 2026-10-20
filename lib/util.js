const YT_RANDOM_URL = process.env.YT_RANDOM_URL;
const YT_RANDOM_USER = process.env.YT_RANDOM_USER;
const YT_RANDOM_PASSWORD = process.env.YT_RANDOM_PASSWORD;

function getRandom(arr = []) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

export async function getRandomVideos(channelIds = [], randomPicks = 0) {
  if (randomPicks === 0) return [];

  if (!YT_RANDOM_URL || !YT_RANDOM_USER || !YT_RANDOM_PASSWORD) {
    console.warn('yt-random variables not configured. Skipping.');
    return [];
  }

  // first pick random channels
  const randomChannels = [];
  for (let i = 0; i < Math.min(channelIds.length, randomPicks); i++) {
    let channelId = '';

    do {
      channelId = getRandom(channelIds);
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
        headers: { Authorization: `Basic ${credentials}` },
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
  const videos = results.filter((video) => video != null);

  // normalize data
  return videos.map((video) => ({
    ...video,
    link: `https://youtube.com/watch?v=${video.id}`,
    channel: `https://youtube.com/channel/${video.channelId}`,
  }));
}

export function domainRedirect(link, domain) {
  return `https://${domain}` + link.split('youtube.com')[1];
}

// export async function retryWithExponentialBackoff(
//   operation = () => {},
//   { retries = 5, initialDelayMs = 250 } = {},
// ) {
//   let delay = initialDelayMs;

//   for (let attempt = 0; ; attempt += 1) {
//     try {
//       return operation();
//     } catch (error) {
//       if (attempt >= retries) throw error;
//       await new Promise((resolve) => setTimeout(resolve, delay));
//       delay *= 2;
//     }
//   }
// }
