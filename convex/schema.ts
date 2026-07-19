import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth tables (user, session, account, verification) are managed
  // automatically by the @convex-dev/better-auth component.

  // AUTH STATS - Signup tracking for Shipper analytics dashboard
  // Platform-managed table. Leave this intact.
  authStats: defineTable({
    date: v.string(),        // ISO date string "2024-01-15"
    provider: v.string(),    // "email", "google", "anonymous"
    signups: v.number(),     // Count of signups
    lastUpdated: v.number(), // Timestamp
  })
    .index("date_provider", ["date", "provider"])
    .index("date", ["date"]),

  // Application tables
  sensorSettings: defineTable({
    userId: v.string(),
    sensorId: v.string(),
    customName: v.optional(v.string()),
    isOn: v.optional(v.boolean()),
    // Remote configuration
    reportingInterval: v.optional(v.number()), // seconds between reports
    alertSensitivity: v.optional(v.string()),  // "low" | "balanced" | "high"
    minThreshold: v.optional(v.number()),
    maxThreshold: v.optional(v.number()),
    alertsEnabled: v.optional(v.boolean()),
    ledIndicator: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_sensorId", ["sensorId"]),

  // Per-account device scoping. Keyed by EMAIL (not userId) so an admin can
  // assign modules to an address before that account even exists, and demo
  // seeding stays simple. userEmail is always stored lowercase.
  deviceAssignments: defineTable({
    userEmail: v.string(),
    moduleId: v.string(),
    label: v.optional(v.string()),
    assignedAt: v.number(),
    assignedBy: v.string(),
  })
    .index("by_email", ["userEmail"])
    .index("by_module", ["moduleId"]),

  // Scenes - one-tap shortcuts that set multiple devices to a target state
  scenes: defineTable({
    userId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),   // Ionicons name
    color: v.optional(v.string()),  // hex accent
    // Each action sets one device's shut-off valve to a target state.
    actions: v.array(
      v.object({
        sensorId: v.string(),
        valveOpen: v.boolean(), // true = valve open (water flowing)
      })
    ),
    lastTriggeredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Terminal command history (per user)
  commandHistory: defineTable({
    userId: v.string(),
    command: v.string(),
    success: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "createdAt"]),

  // Per-user app preferences
  userPreferences: defineTable({
    userId: v.string(),
    displayName: v.optional(v.string()),
    propertyLabel: v.optional(v.string()),
    theme: v.optional(v.string()),
    consoleFavorites: v.optional(v.array(v.string())),
    // Water-usage conservation goal (monthly target, in the server metric's units)
    usageGoal: v.optional(v.number()),
    // Notification category toggles (default ON when unset)
    notifyLeak: v.optional(v.boolean()),
    notifyConnectivity: v.optional(v.boolean()),
    notifyBattery: v.optional(v.boolean()),
    notifyUsage: v.optional(v.boolean()),
    // Quiet hours — local hours 0-23; non-critical alerts suppressed inside the window
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.number()),
    quietHoursEnd: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.string(),
    plan: v.string(),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Automations (Trigger → Action workflows)

  // Automations - Trigger → Action workflows
  automations: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    archived: v.optional(v.boolean()),

    triggerType: v.union(
      v.literal("scheduled"),
      v.literal("data_event")
    ),

    schedule: v.optional(v.object({
      type: v.union(v.literal("interval"), v.literal("cron"), v.literal("once")),
      intervalMinutes: v.optional(v.number()),
      cronExpression: v.optional(v.string()),
      runAt: v.optional(v.number()),
      timezone: v.optional(v.string()),
    })),

    dataEvent: v.optional(v.object({
      tableName: v.string(),
      event: v.union(
        v.literal("create"),
        v.literal("update"),
        v.literal("delete")
      ),
      filter: v.optional(v.string()),
    })),

    actionPath: v.string(),
    actionArgs: v.optional(v.string()),
    type: v.optional(v.union(v.literal("email"), v.literal("general"))),

    lastRunAt: v.optional(v.number()),
    lastRunStatus: v.optional(v.union(v.literal("success"), v.literal("failure"))),
    nextScheduledRunId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enabled", ["enabled"])
    .index("by_trigger_type", ["triggerType", "enabled"]),

  automation_runs: defineTable({
    automationId: v.id("automations"),
    status: v.union(v.literal("running"), v.literal("success"), v.literal("failure")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    output: v.optional(v.string()),
    triggeredBy: v.union(
      v.literal("schedule"),
      v.literal("data_event"),
      v.literal("manual")
    ),
    eventPayload: v.optional(v.string()),
  })
    .index("by_automation", ["automationId", "startedAt"])
    .index("by_status", ["status", "startedAt"]),

});
