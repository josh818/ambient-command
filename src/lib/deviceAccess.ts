import { useQuery } from 'convex/react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../convex/_generated/api';

// Per-account device scoping (see convex/access.ts).
//
// moduleIds semantics:
//   null  → unrestricted (admin, or signed-out preview — current behavior)
//   []    → signed in but no devices assigned to this account
//   [...] → only these module ids are visible
//
// While the access query is still resolving for a signed-in user we report
// loading: true so callers can render nothing instead of flashing the full
// fleet before the filter arrives.

export interface DeviceAccess {
  /** True while signed in and the access query hasn't resolved yet. */
  loading: boolean;
  isAdmin: boolean;
  moduleIds: string[] | null;
  /** Signed-in email (shown in the empty state so admins know what to assign). */
  userEmail: string | null;
}

const EMPTY_IDS: string[] = [];

// ── OPEN ACCESS MODE ────────────────────────────────────────────────────────
// true  → every signed-in account sees the FULL fleet (per-account assignment
//         scoping is bypassed). The owner enabled this for the testing phase
//         so test users can browse all devices without assignments.
// false → normal per-account scoping: users only see devices assigned to
//         their email via the admin Device Access screen.
// Server-side admin checks on assignment mutations stay enforced either way.
export const OPEN_ACCESS = true;

export function useDeviceAccess(): DeviceAccess {
  const { data: session } = useSession();
  const access = useQuery(api.access.myDeviceAccess, session ? {} : 'skip');
  const userEmail = session?.user?.email ?? null;

  if (!session) {
    // Signed out — keep existing behavior (auth gate handles the rest).
    return { loading: false, isAdmin: false, moduleIds: null, userEmail: null };
  }

  if (OPEN_ACCESS) {
    // Everyone sees everything; only the admin flag still comes from the
    // server (it gates the Device Access management screen).
    return {
      loading: false,
      isAdmin: access?.isAdmin ?? false,
      moduleIds: null,
      userEmail,
    };
  }

  // undefined → query in flight; null → server hasn't seen the auth token yet
  // (Better Auth token can lag sign-in). Both mean "don't show anything yet".
  if (access === undefined || access === null) {
    return { loading: true, isAdmin: false, moduleIds: EMPTY_IDS, userEmail };
  }

  return {
    loading: false,
    isAdmin: access.isAdmin,
    moduleIds: access.moduleIds,
    userEmail,
  };
}
