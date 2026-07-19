import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
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

// Create a new sensorSetting
export const createSensorSetting = mutation({
  args: {
    sensorId: v.string(),
    customName: v.optional(v.string()),
    isOn: v.optional(v.boolean()),
    reportingInterval: v.optional(v.number()),
    alertSensitivity: v.optional(v.string()),
    minThreshold: v.optional(v.number()),
    maxThreshold: v.optional(v.number()),
    alertsEnabled: v.optional(v.boolean()),
    ledIndicator: v.optional(v.boolean()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const id = await ctx.db.insert("sensorSettings", {
      userId: user._id,
      sensorId: args.sensorId,
      customName: args.customName,
      isOn: args.isOn,
      reportingInterval: args.reportingInterval,
      alertSensitivity: args.alertSensitivity,
      minThreshold: args.minThreshold,
      maxThreshold: args.maxThreshold,
      alertsEnabled: args.alertsEnabled,
      ledIndicator: args.ledIndicator,
      updatedAt: args.updatedAt,
    });
    const doc = await ctx.db.get(id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "sensorSettings",
      event: "create",
      document: doc ? JSON.stringify(doc) : undefined,
    });
    return id;
  },
});

// Update a sensorSetting (only if owned by user)
export const updateSensorSetting = mutation({
  args: {
    id: v.id("sensorSettings"),
    sensorId: v.optional(v.string()),
    customName: v.optional(v.optional(v.string())),
    isOn: v.optional(v.optional(v.boolean())),
    reportingInterval: v.optional(v.number()),
    alertSensitivity: v.optional(v.string()),
    minThreshold: v.optional(v.number()),
    maxThreshold: v.optional(v.number()),
    alertsEnabled: v.optional(v.boolean()),
    ledIndicator: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    const doc = await ctx.db.get(args.id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "sensorSettings",
      event: "update",
      document: doc ? JSON.stringify(doc) : undefined,
    });
    return args.id;
  },
});

// Delete a sensorSetting (only if owned by user)
export const deleteSensorSetting = mutation({
  args: { id: v.id("sensorSettings") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "sensorSettings",
      event: "delete",
      document: JSON.stringify(existing),
    });
    return args.id;
  },
});

// ---------------------------------------------------------------------------
// SCENES — one-tap shortcuts that set multiple devices to a target state.
// ---------------------------------------------------------------------------

const sceneActionValidator = v.object({
  sensorId: v.string(),
  valveOpen: v.boolean(),
});

export const createScene = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    actions: v.array(sceneActionValidator),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("scenes", {
      userId: user._id,
      name: args.name,
      icon: args.icon,
      color: args.color,
      actions: args.actions,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateScene = mutation({
  args: {
    id: v.id("scenes"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    actions: v.optional(v.array(sceneActionValidator)),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, { ...cleanUpdates, updatedAt: Date.now() });
    return args.id;
  },
});

export const deleteScene = mutation({
  args: { id: v.id("scenes") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Trigger a scene: apply every action's target valve state to the matching
// sensorSetting in a single atomic mutation, so all devices update at once.
export const triggerScene = mutation({
  args: { id: v.id("scenes") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    const scene = await ctx.db.get(args.id);
    if (!scene || scene.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const now = Date.now();
    const existingSettings = await ctx.db
      .query("sensorSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    const bySensor = new Map(existingSettings.map((s) => [s.sensorId, s]));

    for (const action of scene.actions) {
      const setting = bySensor.get(action.sensorId);
      if (setting) {
        await ctx.db.patch(setting._id, { isOn: action.valveOpen, updatedAt: now });
      } else {
        await ctx.db.insert("sensorSettings", {
          userId: user._id,
          sensorId: action.sensorId,
          isOn: action.valveOpen,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.id, { lastTriggeredAt: now });
    return { applied: scene.actions.length };
  },
});

// Record a terminal command in history
export const logCommand = mutation({
  args: {
    command: v.string(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    return await ctx.db.insert("commandHistory", {
      userId: user._id,
      command: args.command,
      success: args.success,
      createdAt: Date.now(),
    });
  },
});

// Create or update the authenticated user's preferences
export const upsertPreferences = mutation({
  args: {
    displayName: v.optional(v.string()),
    propertyLabel: v.optional(v.string()),
    theme: v.optional(v.string()),
    consoleFavorites: v.optional(v.array(v.string())),
    usageGoal: v.optional(v.number()),
    notifyLeak: v.optional(v.boolean()),
    notifyConnectivity: v.optional(v.boolean()),
    notifyBattery: v.optional(v.boolean()),
    notifyUsage: v.optional(v.boolean()),
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.number()),
    quietHoursEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    const updates = Object.fromEntries(
      Object.entries(args).filter(([_, v]) => v !== undefined)
    );
    if (existing) {
      await ctx.db.patch(existing._id, { ...updates, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("userPreferences", {
      userId: user._id,
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Create a new subscription
export const createSubscription = mutation({
  args: {
    plan: v.string(),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const id = await ctx.db.insert("subscriptions", {
      userId: user._id,
      plan: args.plan,
      status: args.status,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodEnd: args.currentPeriodEnd,
      updatedAt: args.updatedAt,
    });
    const doc = await ctx.db.get(id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "subscriptions",
      event: "create",
      document: doc ? JSON.stringify(doc) : undefined,
    });
    return id;
  },
});

// Update a subscription (only if owned by user)
export const updateSubscription = mutation({
  args: {
    id: v.id("subscriptions"),
    plan: v.optional(v.string()),
    status: v.optional(v.string()),
    stripeCustomerId: v.optional(v.optional(v.string())),
    stripeSubscriptionId: v.optional(v.optional(v.string())),
    currentPeriodEnd: v.optional(v.optional(v.number())),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    const doc = await ctx.db.get(args.id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "subscriptions",
      event: "update",
      document: doc ? JSON.stringify(doc) : undefined,
    });
    return args.id;
  },
});

// Delete a subscription (only if owned by user)
export const deleteSubscription = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    await ctx.scheduler.runAfter(0, internal.automations.onDataEvent, {
      table: "subscriptions",
      event: "delete",
      document: JSON.stringify(existing),
    });
    return args.id;
  },
});
