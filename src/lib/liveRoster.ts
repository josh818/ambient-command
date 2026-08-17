// Live module roster — fetches GetModuleListing at runtime so devices
// provisioned on the server AFTER this build (new module_ids) still show
// up in the app without a code change. The static mockSensors list remains
// the offline fallback; this augments and refreshes it.
//
// Module-level cache (5 min TTL) + in-flight dedupe, mirroring the
// patterns in sparkHistory/measurementData.

import { useEffect, useState } from 'react';
import { getModuleListing } from './api';

export interface RosterEntry {
  id: string;
  unitName: string;
  locationName: string;
}

const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; entries: RosterEntry[] } | null = null;
let inflight: Promise<RosterEntry[]> | null = null;

async function fetchRoster(): Promise<RosterEntry[]> {
  const records = await getModuleListing();
  return records
    .map((r) => ({
      id: String((r as Record<string, unknown>).module_id ?? '').trim(),
      unitName: String((r as Record<string, unknown>).unit_name ?? '').trim(),
      locationName: String((r as Record<string, unknown>).location_name ?? '').trim(),
    }))
    .filter((e) => e.id.length > 0);
}

function getRoster(): Promise<RosterEntry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.entries);
  if (inflight) return inflight;
  inflight = fetchRoster()
    .then((entries) => {
      cache = { at: Date.now(), entries };
      inflight = null;
      return entries;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

/**
 * Live server roster. `entries` is null while loading or when the server is
 * unreachable — callers fall back to the static catalog in that case (never
 * fabricate devices).
 */
export function useLiveRoster(): { entries: RosterEntry[] | null; loading: boolean } {
  const [entries, setEntries] = useState<RosterEntry[] | null>(
    cache ? cache.entries : null,
  );
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    getRoster()
      .then((e) => {
        if (!cancelled) {
          setEntries(e);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, loading };
}
