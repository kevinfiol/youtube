import { render } from '../src/render.js';

const dev = process.argv.includes('-d');
const write = process.argv.includes('-w');

await render(dev, write);