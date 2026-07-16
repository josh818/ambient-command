import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// Type for Better Auth user (for TypeScript)
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}

// List all sensorSettings for the authenticated user
// Available as: api.queries.listSensorSettings OR api.queries.getMySensorSettings
export const listSensorSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("sensorSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listSensorSettings - use whichever name you prefer
export const getMySensorSettings = listSensorSettings;

// Get a single sensorSetting by ID (only if owned by user)
export const getSensorSetting = query({
  args: { id: v.id("sensorSettings") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List all scenes for the authenticated user
export const listScenes = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];
    return await ctx.db
      .query("scenes")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Get a single scene by ID (only if owned by user)
export const getScene = query({
  args: { id: v.id("scenes") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List recent command history for the authenticated user
export const listCommandHistory = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];
    return await ctx.db
      .query("commandHistory")
      .withIndex("by_user_time", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

// Get the authenticated user's preferences
export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;
    return await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

// List all subscriptions for the authenticated user
// Available as: api.queries.listSubscriptions OR api.queries.getMySubscriptions
export const listSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listSubscriptions - use whichever name you prefer
export const getMySubscriptions = listSubscriptions;

// Get a single subscription by ID (only if owned by user)
export const getSubscription = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});
