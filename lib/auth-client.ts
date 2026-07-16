/**
 * Better Auth Client for Expo (React Native)
 * Uses expo-secure-store for encrypted session storage on native
 * Shipper auth template version: convex-better-auth-0.12.2+better-auth-1.6.11
 * @see https://convex-better-auth.netlify.app/
 */
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { anonymousClient, genericOAuthClient } from "better-auth/client/plugins";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { AUTH_CONFIG } from "../shipper.auth";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Better Auth client instance
 * - Native: convexClient + expoClient with encrypted SecureStore
 * - Web preview: convexClient + crossDomainClient
 * - Provider wiring only; app UI should use the helper functions below
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.EXPO_PUBLIC_CONVEX_SITE_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "",
  plugins: [
    convexClient(),
    ...(Platform.OS === "web"
      ? [crossDomainClient()]
      : [expoClient({ storage: SecureStore })]),
    genericOAuthClient(),
    anonymousClient(),
  ],
});

export { AUTH_CONFIG };
export const { useSession } = authClient;

type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

export interface AuthError {
  message: string;
  code?: AuthErrorCode | string;
}

export interface SignInResult {
  success: boolean;
  error?: AuthError;
}

const errorMessages: Partial<Record<AuthErrorCode | string, string>> = {
  USER_NOT_FOUND: "No account found with this email",
  INVALID_PASSWORD: "Invalid password",
  USER_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_EMAIL: "Please enter a valid email address",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  PASSWORD_TOO_LONG: "Password is too long",
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later",
};

export function getErrorMessage(code: string | undefined): string {
  if (!code) return "An unexpected error occurred";
  return errorMessages[code] ?? code.replace(/_/g, " ").toLowerCase();
}

function parseAuthError(error: unknown): AuthError {
  if (error && typeof error === "object") {
    const maybeError = error as { code?: string; message?: string };
    return {
      message: maybeError.message ?? getErrorMessage(maybeError.code),
      code: maybeError.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred" };
}

function getDefaultCallbackURL(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL("/", window.location.origin).toString();
  }

  return "/";
}

function normalizeLocalPath(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (value.startsWith("/")) return value;
  if (typeof window === "undefined") return fallback;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.emailPasswordEnabled) {
    return {
      success: false,
      error: { message: "Email/password sign-in is disabled" },
    };
  }

  const { error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: getDefaultCallbackURL(),
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.emailPasswordEnabled) {
    return {
      success: false,
      error: { message: "Email/password sign-up is disabled" },
    };
  }
  if (!AUTH_CONFIG.signupEnabled) {
    return {
      success: false,
      error: { message: "Signups are disabled" },
    };
  }

  const { error } = await authClient.signUp.email({
    email,
    password,
    name: name ?? "",
    callbackURL: getDefaultCallbackURL(),
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

export async function signInWithGoogle(callbackURL?: string): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.googleEnabled) {
    return {
      success: false,
      error: { message: "Google sign-in is disabled" },
    };
  }

  const redirectURL =
    Platform.OS === "web" && typeof window !== "undefined"
      ? new URL(normalizeLocalPath(callbackURL, "/"), window.location.origin).toString()
      : callbackURL ?? "/";

  const { error } = await authClient.signIn.oauth2({
    providerId: "shipper-google",
    callbackURL: redirectURL,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

export async function signInAnonymously(): Promise<SignInResult> {
  if (!AUTH_CONFIG.authEnabled) {
    return {
      success: false,
      error: { message: "Authentication is disabled" },
    };
  }
  if (!AUTH_CONFIG.anonymousEnabled) {
    return {
      success: false,
      error: { message: "Anonymous access is disabled" },
    };
  }
  if (!AUTH_CONFIG.signupEnabled) {
    return {
      success: false,
      error: { message: "Anonymous access is disabled when signups are disabled" },
    };
  }

  const { error } = await authClient.signIn.anonymous();

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

export async function signOutUser(): Promise<SignInResult> {
  const { error } = await authClient.signOut();

  if (error) {
    return {
      success: false,
      error: parseAuthError(error),
    };
  }

  return { success: true };
}
