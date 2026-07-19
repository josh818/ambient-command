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

// Per-test-account device assignments (see convex/access.ts). The demo
// account gets the full demo roster; the tester account only gets the first
// two modules so it demonstrates per-account scoping side by side.
// NOTE: neither of these emails is an admin.
const DEMO_DEVICE_ASSIGNMENTS: Record<string, string[]> = {
  "demo@ambientcommand.app": DEMO_MODULE_IDS,
  "josh-tester@ambientcommand.app": DEMO_MODULE_IDS.slice(0, 2),
};

/**
 * Seed a fresh (demo) account with a couple of scenes and a few sensor
 * settings so the dashboard, scene shortcuts and sensor list aren't empty.
 * Also upserts the account's deviceAssignments rows for the two known test
 * accounts so device scoping is demonstrable out of the box.
 *
 * Idempotent: only inserts scenes when the user has none, only inserts
 * sensorSettings when the user has none, and only inserts deviceAssignments
 * when the email has none. Safe to call on every sign-in.
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
        settingsCreated++;
      }
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

      if (existingAssignments.length === 0) {
        for (const moduleId of wantedModuleIds) {
          await ctx.db.insert("deviceAssignments", {
            userEmail: email,
            moduleId,
            assignedAt: now,
            assignedBy: "demo-seed",
          });
          assignmentsCreated++;
        }
      }
    }

    return { scenesCreated, settingsCreated, assignmentsCreated };
  },
});
