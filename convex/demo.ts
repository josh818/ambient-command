import { mutation } from "./_generated/server";
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

// Module ids from the provisioned roster (see src/lib/mockData.ts). Demo data
// references real module ids so scenes/settings line up with the sensor list.
const DEMO_MODULE_IDS = [
  "132062666205048",
  "132062666112508",
  "132062666189884",
  "132062666137092",
];

// The only two modules currently reporting real measurement data on the
// server. Both test accounts should see at least one so the Data Points
// screens have live telemetry to show.
const LIVE_MODULE_IDS = ["132062666074512", "132062666137092"] as const;

// Friendly display names for the live modules (sensorSettings, add-if-missing).
const LIVE_MODULE_NAMES: Record<string, string> = {
  "132062666074512": "Main Line Monitor",
  "132062666137092": "Utility Room",
};

// Per-test-account device assignments (see convex/access.ts). Seeding is
// ADD-IF-MISSING per module — existing rows are always kept, and any module
// listed here that the account is missing gets a new row.
// NOTE: neither of these emails is an admin.
const DEMO_DEVICE_ASSIGNMENTS: Record<string, string[]> = {
  // Demo account: the full demo roster PLUS the live-reporting module.
  "demo@ambientcommand.app": [...DEMO_MODULE_IDS, "132062666074512"],
  // Tester account: both live-reporting modules.
  "josh-tester@ambientcommand.app": [...LIVE_MODULE_IDS],
};

/**
 * Seed a fresh (demo) account with a couple of scenes and a few sensor
 * settings so the dashboard, scene shortcuts and sensor list aren't empty.
 * Also upserts the account's deviceAssignments rows for the two known test
 * accounts so device scoping is demonstrable out of the box.
 *
 * Idempotent: only inserts scenes when the user has none, only inserts the
 * bulk sensorSettings when the user has none (plus add-if-missing friendly
 * names for the two live modules), and inserts deviceAssignments
 * ADD-IF-MISSING per module (existing rows are never removed or changed).
 * Safe to call on every sign-in.
 */
export const ensureDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    let scenesCreated = 0;
    let settingsCreated = 0;

    // --- Scenes -----------------------------------------------------------
    const existingScenes = await ctx.db
      .query("scenes")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    if (existingScenes.length === 0) {
      const demoScenes = [
        {
          name: "Night Mode",
          icon: "moon",
          color: "#60A5FA",
          // Close valves overnight to prevent leaks while asleep.
          actions: DEMO_MODULE_IDS.map((sensorId) => ({
            sensorId,
            valveOpen: false,
          })),
        },
        {
          name: "Away Mode",
          icon: "airplane",
          color: "#818CF8",
          // Shut everything while away from the property.
          actions: DEMO_MODULE_IDS.map((sensorId) => ({
            sensorId,
            valveOpen: false,
          })),
        },
        {
          name: "Home",
          icon: "home",
          color: "#34D399",
          // Open all valves for normal use.
          actions: DEMO_MODULE_IDS.map((sensorId) => ({
            sensorId,
            valveOpen: true,
          })),
        },
      ];

      for (const scene of demoScenes) {
        await ctx.db.insert("scenes", {
          userId: user._id,
          name: scene.name,
          icon: scene.icon,
          color: scene.color,
          actions: scene.actions,
          createdAt: now,
          updatedAt: now,
        });
        scenesCreated++;
      }
    }

    // --- Sensor settings ----------------------------------------------------
    const existingSettings = await ctx.db
      .query("sensorSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    const settingIds = new Set(existingSettings.map((s: any) => s.sensorId));

    if (existingSettings.length === 0) {
      const demoSettings = [
        {
          sensorId: DEMO_MODULE_IDS[0],
          customName: "Basement Main",
          isOn: true,
          alertsEnabled: true,
          alertSensitivity: "balanced",
        },
        {
          sensorId: DEMO_MODULE_IDS[1],
          customName: "Kitchen Sink",
          isOn: true,
          alertsEnabled: true,
          alertSensitivity: "high",
        },
        {
          sensorId: DEMO_MODULE_IDS[2],
          customName: "Water Heater",
          isOn: true,
          alertsEnabled: true,
          alertSensitivity: "balanced",
        },
        {
          sensorId: DEMO_MODULE_IDS[3],
          customName: "Laundry Room",
          isOn: false,
          alertsEnabled: false,
          alertSensitivity: "low",
        },
      ];

      for (const setting of demoSettings) {
        await ctx.db.insert("sensorSettings", {
          userId: user._id,
          sensorId: setting.sensorId,
          customName: setting.customName,
          isOn: setting.isOn,
          alertsEnabled: setting.alertsEnabled,
          alertSensitivity: setting.alertSensitivity,
          updatedAt: now,
        });
        settingIds.add(setting.sensorId);
        settingsCreated++;
      }
    }

    // Friendly names for the two live-reporting modules — add-if-missing per
    // sensorId (never overwrites a name the user already has).
    for (const moduleId of LIVE_MODULE_IDS) {
      if (settingIds.has(moduleId)) continue;
      await ctx.db.insert("sensorSettings", {
        userId: user._id,
        sensorId: moduleId,
        customName: LIVE_MODULE_NAMES[moduleId],
        isOn: true,
        alertsEnabled: true,
        alertSensitivity: "balanced",
        updatedAt: now,
      });
      settingIds.add(moduleId);
      settingsCreated++;
    }

    // --- Device assignments -------------------------------------------------
    // Only for the known test accounts; real accounts are managed by an admin
    // from Settings → Device Access.
    let assignmentsCreated = 0;
    const email = (user.email ?? "").trim().toLowerCase();
    const wantedModuleIds = DEMO_DEVICE_ASSIGNMENTS[email];

    if (wantedModuleIds) {
      const existingAssignments = await ctx.db
        .query("deviceAssignments")
        .withIndex("by_email", (q: any) => q.eq("userEmail", email))
        .collect();

      // ADD-IF-MISSING per module: keep every existing row, insert only the
      // modules from the wanted set that the account doesn't have yet.
      const assignedIds = new Set(existingAssignments.map((a: any) => a.moduleId));
      for (const moduleId of wantedModuleIds) {
        if (assignedIds.has(moduleId)) continue;
        await ctx.db.insert("deviceAssignments", {
          userEmail: email,
          moduleId,
          assignedAt: now,
          assignedBy: "demo-seed",
        });
        assignedIds.add(moduleId);
        assignmentsCreated++;
      }
    }

    return { scenesCreated, settingsCreated, assignmentsCreated };
  },
});
