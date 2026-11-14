/**
 * The landing-page sea clip. On the web it is served from `public/scene/` (cached, and only
 * downloaded when the sea comes near the screen); the apps stream the same file from the site.
 */
export const SEA_POSTER = '/scene/sea-poster.jpg';
export const SEA_VIDEO = [
  { src: '/scene/sea.webm', type: 'video/webm' },
  { src: '/scene/sea.mp4', type: 'video/mp4' },
];
export const SEA_REMOTE = 'https://open-map-lab.vercel.app/scene/sea.mp4';
export const SEA_POSTER_NATIVE = require('../../../assets/scene/sea-poster.jpg');
