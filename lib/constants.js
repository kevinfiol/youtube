export const MODE = {
  INVIDIOUS: 'invidious',
  YOUTUBE: 'youtube',
};

export const DOMAIN_VARS = {
  [MODE.INVIDIOUS]: { domain: 'yewtu.be', query: 'q' },
  [MODE.YOUTUBE]: { domain: 'youtube.com', query: 'query' },
};

export const NEWPIPE_APP_VERSION = '4.7.2';
export const NEWPIPE_APP_VERSION_INT = 108500;
export const YEAR_IN_MS = 31536000000;
export const MAX_VIDEOS_PER_CHANNEL = 20;

// units used by youtube's relative dates, e.g. `13h ago`, `2mo ago`
export const TIME_UNITS_MS = {
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000,
  w: 604800000,
  mo: 2592000000,
  y: YEAR_IN_MS,
};
