// BH Sensors REST API client.
// The live server exposes over HTTPS:
//   GET /tms/xdata/MyService/Sum?A=2&B=2
//   GET /tms/xdata/MyService/GetRawDataCount
//   GET /tms/xdata/MyService/GetModuleListing          — all modules
//   GET /tms/xdata/MyService/GetModule?module_id=<id>  — single module
//   GET /tms/xdata/MyService/GetModuleMeasments?module_id=<id>&from_date_str=<YYYY/MM/DD>&to_date_str=<YYYY/MM/DD>&max_count=<n>
//     — measurement history for a module in a date range (note server
//       spelling "Measments" — do not "fix" it, it must match the server).
// Auth is a bearer token sent on every request.

// All requests go through the Convex HTTP proxy (see convex/http.ts, the
// /bh/ routes) instead of hitting the hardware server directly. The hardware
// server (TMS XData) doesn't answer CORS preflights, so direct browser
// fetches fail with "Failed to fetch" even though the server is up — the
// proxy fetches server-side and adds proper CORS headers. It also keeps the
// upstream bearer token out of this shipped bundle.
const CONVEX_SITE =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL || 'https://formal-guanaco-79.convex.site';

export const API_BASE = `${CONVEX_SITE}/bh`;

function authHeaders(): Record<string, string> {
  // No Authorization header needed — the proxy injects the upstream token.
  // Keeping the request header-light also avoids an extra CORS preflight.
  return { Accept: 'application/json' };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Issue a command to a module (valve control, vacation/sabbath modes).
 * Server endpoint: IssueCommand?module_id=<id>&command=<CMD>
 *
 * The command string uses a COMMA as a delimiter the firmware parses on:
 *   VALVE,OPEN | VALVE,CLOSE | VACATION,<days> | SABBATH,<hours>
 * We encodeURIComponent the whole command so the comma survives transit
 * (%2C) and the server decodes it back before parsing. Goes through the same
 * /bh/ proxy as every other call.
 *
 * NOTE: hardware modules sleep between check-ins, so a command is QUEUED on
 * the server and applied when the module next wakes — it is not instant.
 */
export async function issueCommand(moduleId: string, command: string): Promise<void> {
  const qs =
    `module_id=${encodeURIComponent(moduleId)}` +
    `&command=${encodeURIComponent(command)}`;
  await getJson<unknown>(`/IssueCommand?${qs}`);
}

export interface ModuleCommand {
  rec_id?: number;
  module_id?: string;
  rec_date_time?: string;
  command?: string;
}

/** Command history/queue for a module — used to confirm a command was recorded. */
export async function getModuleCommands(moduleId: string): Promise<ModuleCommand[]> {
  const data = await getJson<unknown>(
    `/GetModuleCommands?module_id=${encodeURIComponent(moduleId)}`,
  );
  return toRecordArray(data) as ModuleCommand[];
}

/**
 * Connectivity check. The server used to expose a trivial Sum endpoint for
 * this, but a server update removed it (it now returns "Unknown path"),
 * which made the app think the whole API was down. GetRawDataCount is the
 * health check now: one call proves both service reachability and database
 * connectivity.
 */
export async function checkService(): Promise<number> {
  return await getRawDataCount();
}

/** Returns the raw record count from the database — proves DB connectivity. */
export async function getRawDataCount(): Promise<number> {
  const data = await getJson<{ value?: number } | number>('/GetRawDataCount');
  if (typeof data === 'number') return data;
  return data.value ?? 0;
}

// ── Module data endpoints ────────────────────────────────────────────────────
// The server response shape may be a bare object/array, or wrapped in
// { value: ... } (TMS XData convention). Normalize both defensively.

export type ModuleRecord = Record<string, unknown>;

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'value' in (data as any)) {
    return (data as any).value;
  }
  return data;
}

function toRecordArray(data: unknown): ModuleRecord[] {
  const v = unwrap(data);
  if (Array.isArray(v)) return v as ModuleRecord[];
  if (v && typeof v === 'object') return [v as ModuleRecord];
  return [];
}

/** Full listing of all provisioned modules. */
export async function getModuleListing(): Promise<ModuleRecord[]> {
  const data = await getJson<unknown>('/GetModuleListing');
  return toRecordArray(data);
}

/** Data for a specific module by its module_id (numeric MAC value). */
export async function getModule(moduleId: string): Promise<ModuleRecord[]> {
  const data = await getJson<unknown>(`/GetModule?module_id=${encodeURIComponent(moduleId)}`);
  return toRecordArray(data);
}

/** Format a Date as YYYY/MM/DD — the format the server expects. */
export function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/**
 * Measurement history for a specific module within a date range.
 * NOTE: endpoint name is "GetModuleMeasments" (server's spelling).
 * Dates are strings in YYYY/MM/DD format. max_count caps record volume.
 */
export async function getModuleMeasurements(
  moduleId: string,
  fromDateStr: string,
  toDateStr: string,
  maxCount = 500,
): Promise<ModuleRecord[]> {
  const qs =
    `module_id=${encodeURIComponent(moduleId)}` +
    `&from_date_str=${encodeURIComponent(fromDateStr)}` +
    `&to_date_str=${encodeURIComponent(toDateStr)}` +
    `&max_count=${maxCount}`;
  const data = await getJson<unknown>(`/GetModuleMeasments?${qs}`);
  return toRecordArray(data);
}

/**
 * Modules associated with an email address. Multiple records may be returned.
 * Server endpoint: GetModuleFromEmail?email_str=<email>
 */
export async function getModuleFromEmail(email: string): Promise<ModuleRecord[]> {
  const data = await getJson<unknown>(
    `/GetModuleFromEmail?email_str=${encodeURIComponent(email)}`,
  );
  return toRecordArray(data);
}

/**
 * Modules associated with a mobile/cell phone number. Multiple records may be
 * returned. Server endpoint: GetModuleFromMobileNumber?mobile_str=<number>
 */
export async function getModuleFromMobileNumber(mobile: string): Promise<ModuleRecord[]> {
  const data = await getJson<unknown>(
    `/GetModuleFromMobileNumber?mobile_str=${encodeURIComponent(mobile)}`,
  );
  return toRecordArray(data);
}

export type ApiStatus = 'idle' | 'checking' | 'online' | 'offline';

export interface ConnectivityResult {
  status: ApiStatus;
  rawDataCount: number | null;
  error: string | null;
  checkedAt: number | null;
}
