// Public deployment addresses from the existing app. These are not credentials.
// Environment overrides allow a separate backend for staging or native builds.
export const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ||
  'https://formal-guanaco-79.convex.cloud';
export const convexSiteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ||
  convexUrl.replace(/\.convex\.cloud\/?$/, '.convex.site');
