import { render } from './render.js';

const dev = process.argv.includes('-d');
const write = process.argv.includes('-w');

(async () => {
    await render(dev, write);
})();