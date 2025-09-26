export const MODE = {
  INVIDIOUS: 0,
  YOUTUBE: 1,
};

export const DOMAIN_VARS = {
  [MODE.INVIDIOUS]: { domain: 'yewtu.be', query: 'q', search: 'search' },
  [MODE.YOUTUBE]: { domain: 'youtube.com', query: 'search_query', search: 'results' }
};

export const FEED_CONTENT_TYPES = [
  'application/atom+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml'
];

export const NEWPIPE_APP_VERSION = '4.7.2';
export const NEWPIPE_APP_VERSION_INT = 108500;
export const YEAR_IN_MS = 31536000000;
export const TIMEZONE_OFFSET = -4.0;