import servbot from 'servbot';
import { watch } from 'watchlist';
import { render } from './render.js';

const DIST_PATH = 'dist';
const SRC_PATH = 'src';

const server = servbot({
    root: DIST_PATH,
    reload: true,
    fallback: 'index.html'
});

server.listen(8080);

(async () => {
    await watch([SRC_PATH], async () => {
        await render();
        server.reload();
    });
})();