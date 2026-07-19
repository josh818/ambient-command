import { query, mutation } from "./_generated/server";
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

// Accounts that can see the FULL fleet and manage device assignments.
// Extend this list to add more administrators.
export const ADMIN_EMAILS = ["joshuahay@gmail.com"];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAdmin(user: BetterAuthUser | null): boolean {
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(normalizeEmail(user.email));
}

async function requireAdmin(ctx: any): Promise<BetterAuthUser> {
  const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
  if (!user) throw new Error("Not authenticated");
  if (!isAdmin(user)) throw new Error("Admin access required");
  return user;
}

/**
 * Device access for the signed-in user.
 * - moduleIds === null  → unrestricted (admins see the whole fleet)
 * - moduleIds === []    → nothing assigned to this account yet
 * Returns null while unauthenticated (e.g. auth token still propagating) so
 * the client can keep treating it as "loading" instead of flashing a state.
 */
export const myDeviceAccess = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ isAdmin: boolean; moduleIds: string[] | null } | null> => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return null;

    if (isAdmin(user)) {
      return { isAdmin: true, moduleIds: null };
    }

    const rows = await ctx.db
      .query("deviceAssignments")
      .withIndex("by_email", (q: any) =>
        q.eq("userEmail", normalizeEmail(user.email)),
      )
      .collect();

    // Dedupe defensively in case of duplicate rows.
    const moduleIds = [...new Set(rows.map((r) => r.moduleId))];
    return { isAdmin: false, moduleIds };
  },
});

/**
 * Admin-only: assign a module to an account by email. Upserts — if the
 * (email, module) pair already exists it just refreshes label/timestamp.
 */
export const assignDevice = mutation({
  args: {
    userEmail: v.string(),
    moduleId: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const userEmail = normalizeEmail(args.userEmail);
    if (!userEmail || !userEmail.includes("@")) {
      throw new Error("Enter a valid email address");
    }
    const moduleId = args.moduleId.trim();
    if (!moduleId) throw new Error("moduleId is required");

    const existing = await ctx.db
      .query("deviceAssignments")
      .withIndex("by_email", (q: any) => q.eq("userEmail", userEmail))
      .collect();
    const match = existing.find((r) => r.moduleId === moduleId);

    if (match) {
      await ctx.db.patch(match._id, {
        label: args.label ?? match.label,
        assignedAt: Date.now(),
        assignedBy: normalizeEmail(admin.email),
      });
      return match._id;
    }

    return await ctx.db.insert("deviceAssignments", {
      userEmail,
      moduleId,
      label: args.label,
      assignedAt: Date.now(),
      assignedBy: normalizeEmail(admin.email),
    });
  },
});

/** Admin-only: remove a module assignment from an account. */
export const unassignDevice = mutation({
  args: {
    userEmail: v.string(),
    moduleId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const userEmail = normalizeEmail(args.userEmail);
    const rows = await ctx.db
      .query("deviceAssignments")
      .withIndex("by_email", (q: any) => q.eq("userEmail", userEmail))
      .collect();

    let removed = 0;
    for (const row of rows) {
      if (row.moduleId === args.moduleId.trim()) {
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return { removed };
  },
});

/** Admin-only: every assignment, flat (client groups by email). */
export const listAllAssignments = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user || !isAdmin(user)) return [];

    const rows = await ctx.db.query("deviceAssignments").collect();
    return rows
      .map((r) => ({
        _id: r._id,
        userEmail: r.userEmail,
        moduleId: r.moduleId,
        label: r.label,
        assignedAt: r.assignedAt,
        assignedBy: r.assignedBy,
      }))
      .sort(
        (a, b) =>
          a.userEmail.localeCompare(b.userEmail) || b.assignedAt - a.assignedAt,
      );
  },
});
