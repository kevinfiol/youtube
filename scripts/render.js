import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { get } from 'httpie';
import Parser from 'rss-parser';
import { compile } from 'yeahjs';

const DEV = false;
const FEEDS_JSON = 'src/feeds.json';
const INPUT_TEMPLATE = 'src/template.html';
const OUTPUT_FILE = 'dist/index.html';
const YOUTUBE_URL = 'yewtu.be';

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

export async function render() {
    let videos = [];

    if (DEV) {
        // load from file
    } else {
        for (const feed of FEEDS) {
            try {
                const body = await get(feed).then(parseFeed);
                
                const contents = typeof body == 'string'
                    ? await PARSER.parseString(body)
                    : body;

                contents.items.forEach(item => {
                    videos.push({
                        ...item,
                        thumbnail: item.group['media:thumbnail'][0]['$'].url,
                        channel: contents.link
                    });
                });
            } catch (e) {
                console.error(e);
            }
        }
    }

    videos.sort((a, b) => {
        return a.pubDate < b.pubDate ? 1 : -1;
    });

    console.log(videos);

    // const source = readFileSync(resolve(INPUT_TEMPLATE), { encoding: 'utf8' });
    // const template = compile(source, { localsName: 'it' });
    // const html = template();
    // writeFileSync(resolve(OUTPUT_FILE), html, { encoding: 'utf8' });
}

// (async () => {
//     const contentFromAllFeeds = {};
//     const errors = [];

//     if (!DEV) {
//         for (const group in feeds) {
//             contentFromAllFeeds[group] = [];

//             for (let index = 0; index < feeds[group].length; index++) {
//                 try {
//                     const response = await get(feeds[group][index]);
//                     const body = parseFeed(response);
//                     const contents =
//                     typeof body === "string" ? await parser.parseString(body) : body;

//                     contents.feed = feeds[group][index];
//                     contents.title = contents.title ? contents.title : contents.link;
//                     contentFromAllFeeds[group].push(contents);

//                     // try to normalize date attribute naming
//                     contents.items.forEach(item => {
//                         const timestamp = new Date(item.pubDate || item.isoDate || item.date).getTime();
//                         item.timestamp = isNaN(timestamp) ? (item.pubDate || item.isoDate || item.date) : timestamp;

//                         const formattedDate = new Date(item.timestamp).toLocaleDateString()
//                         item.timestamp = formattedDate !== 'Invalid Date' ? formattedDate : dateString;

//                         // correct link url if lacks hostname
//                         if (item.link && item.link.split('http').length == 1) {
//                             let newLink;

//                             if (contents.link.slice(-1) == '/' && item.link.slice(0, 1) == '/') {
//                                 newLink = contents.link + item.link.slice(1);
//                             } else {
//                                 newLink = contents.link + item.link;
//                             }

//                             item.link = newLink;
//                         }
                        
//                         // replace twitter links with nitter
//                         let twitterMatch = matchTwitter(item.link);
//                         if (twitterMatch) {
//                             item.link = item.link.replace(twitterMatch, `://${NITTER_URL}/`);
//                         }
                        
//                         // replace medium links with scribe.rip
//                         if (item.link.indexOf('medium.com/') !== -1) {
//                             item.link = `https://${MEDIUM_URL}/` + item.link;
//                         }

//                         // redirect youtube links to piped
//                         if (item.link.indexOf('youtube.com/') !== -1) {
//                             item.link = `https://${YOUTUBE_URL}` + item.link.split('youtube.com')[1];
//                         }
//                     });

//                     // sort items
//                     contents.items.sort((a, b) => {
//                         const [aDate, bDate] = [parseDate(a), parseDate(b)];
//                         if (!aDate || !bDate) return 0; 
//                         return bDate - aDate;
//                     });
//                 } catch (error) {
//                   console.error(error);
//                   errors.push(feeds[group][index]);
//                 }
//           }
//         }
//     }

//     let groups;

//     if (DEV) {
//         const testJson = JSON.parse(readFileSync(join(__dirname, './data.json'), { encoding: 'utf8' }));
//         groups = Object.entries(testJson);
//     } else {
//         groups = Object.entries(contentFromAllFeeds);
//         writeFileSync(join(__dirname, './data.json'), JSON.stringify(contentFromAllFeeds), 'utf8');
//     }

//     // sort feeds
//     for (let i = 0, len = groups.length; i < len; i++) {
//         // for each group, sort the feeds
//         // sort the feeds by comparing the isoDate of the first items of each feed
//         groups[i][1].sort((a, b) => {
//             const [aDate, bDate] = [parseDate(a.items[0]), parseDate(b.items[0])];
//             if (!aDate || !bDate) return 0; 
//             return bDate - aDate;
//         });
//     }

//     const now = getNowDate().toString();
//     const html = render({ groups, now, errors });
//     writeFileSync(join(__dirname, OUTPUT_FILE), html, { encoding: 'utf8' });
// })();

function parseDate(item) {
    if (item) {
        if (item.isoDate) return new Date(item.isoDate);
        else if (item.pubDate) return new Date(item.pubDate);
    }

    return null;
}

function getNowDate(){
    //EST
    const offset = -4.0
    
    let d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    d = new Date(utc + (3600000 * offset));
    return d;
}

