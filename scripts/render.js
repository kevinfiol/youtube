import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { get } from 'httpie';
import Parser from 'rss-parser';
import { compile } from 'yeahjs';

const FEEDS_JSON = 'src/feeds.json';
const INPUT_TEMPLATE = 'src/template.html';
const OUTPUT_FILE = 'dist/index.html';
const TEST_FILE = 'src/data.json';
const YOUTUBE_URL = 'invidious.snopyta.org';
const NOW = getNowDate();
const YEAR_IN_MS = 31536000000;

const FEEDS = JSON.parse(readFileSync(resolve(FEEDS_JSON), { encoding: 'utf8' }));
const PARSER = new Parser({
    customFields: {
        item: [
            ['media:group', 'group']
        ]
    }
});

// parse XML or JSON feeds
function parseFeed(response) {
    const contentType = response.headers['content-type']
        ? response.headers['content-type'].split(";")[0]
        : false;

    if (!contentType) return false;

    const contentTypes = [
        'application/json',
        'application/atom+xml',
        'application/rss+xml',
        'application/xml',
        'text/xml',
        'text/html' // this is kind of a gamble
    ];

    if (contentTypes.includes(contentType)) {
        return response.data;
    }

    return false;
}

export async function render(dev = false, write = false) {
    let videos = {};

    if (dev) {
        videos = JSON.parse(readFileSync(resolve(TEST_FILE)), { encoding: 'utf8' });
    } else {
        for (const [_channel, feed] of FEEDS) {
            try {
                const body = await get(feed).then(parseFeed);
                
                const contents = typeof body == 'string'
                    ? await PARSER.parseString(body)
                    : body;

                contents.items.forEach(item => {
                    const pubDate = new Date(item.pubDate);
                    const diffInMs = NOW - pubDate;

                    // don't include videos more than a year old
                    if (diffInMs > YEAR_IN_MS) return;

                    const month = pubDate.getMonth() + 1;
                    const date = pubDate.getDate();
                    const dateStr = `${pubDate.getFullYear()}.${month < 10 ? `0${month}` : month}.${date < 10 ? `0${date}` : date}`;

                    if (!videos[dateStr]) videos[dateStr] = [];

                    videos[dateStr].push({
                        ...item,
                        dateStr,
                        youtube: item.link + '&redirect=false', // query param to use with kevinfiol/redirector
                        link: `https://${YOUTUBE_URL}` + item.link.split('youtube.com')[1], // redirect
                        thumbnail: item.group['media:thumbnail'][0]['$'].url,
                        channel: `https://${YOUTUBE_URL}` + contents.link.split('youtube.com')[1] // redirect
                    });
                });
            } catch (e) {
                console.error(e);
            }
        }

        if (write) writeFileSync(resolve(TEST_FILE), JSON.stringify(videos), 'utf8');
    }

    for (let day in videos) {
        // sort videos per day by pubDate
        videos[day].sort((a, b) => {
            return a.pubDate < b.pubDate ? 1 : -1;
        });
    }

    // get a sorted list of days
    const days = Object.keys(videos).sort((a, b) => {
        return a < b ? 1 : -1;
    });

    const now = NOW.toString().split('(')[0].trim();

    // search url
    const searchUrl = `https://${YOUTUBE_URL}/search`;

    const source = readFileSync(resolve(INPUT_TEMPLATE), { encoding: 'utf8' });
    const template = compile(source, { localsName: 'it' });
    const html = template({ videos, days, now, searchUrl });
    writeFileSync(resolve(OUTPUT_FILE), html, { encoding: 'utf8' });
}

function getNowDate() {
    //EST
    const offset = -4.0
    let d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    d = new Date(utc + (3600000 * offset));
    return d;
}

