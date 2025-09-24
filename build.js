import { render } from './src/render.js';
import { MODES } from './src/modes.js';

const dev = process.argv.includes('-d');
const write = process.argv.includes('-w');
const useEmbedUrls = true;

await render({ dev, write, mode: MODES.YOUTUBE, useEmbedUrls });
