import { config } from './config.js';
import { channels } from './channels.js';
import { getFeedUrls } from './util.js';

const TEST = Deno.args.includes('--use-test-data');
const WRITE = Deno.args.includes('--write-test-data');

const data = {
  videos: [],
  channelLinks: [],
  randomVideos: []
};

if (TEST) {
  // use cached test data
  const cached 

} else {

}

const feedUrls = await getFeedUrls(channels);
console.log(feedUrls);