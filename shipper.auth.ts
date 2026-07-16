/**
 * Generated auth settings for shipper.auth.ts
 * These flags are managed by Shipper Cloud project auth settings.
 */
export const SHIPPER_AUTH_TEMPLATE_VERSION = "convex-better-auth-0.12.2+better-auth-1.6.11" as const;
export const AUTH_CONFIG = {
  authEnabled: true,
  signupEnabled: true,
  emailPasswordEnabled: true,
  // Google login previously proxied through Shipper's own OAuth broker
  // (SHIPPER_AUTH_PROXY_URL). Disabled now that this app is independent of
  // Shipper; re-enable once a real Google OAuth client is set up directly.
  googleEnabled: false,
  anonymousEnabled: false,
} as const;

export type AuthConfig = typeof AUTH_CONFIG;
