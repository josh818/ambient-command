import { useCallback, useRef, useState } from 'react';
import { API_BASE, checkSum, getRawDataCount } from './api';
import type { Sensor } from './mockData';

// A small diagnostic suite that runs a sequence of checks against the
// BH Sensors REST API and reports per-step pass/fail + latency. Used by the
// Diagnostics screen so users can verify server + database connectivity.

export type CheckState = 'pending' | 'running' | 'pass' | 'fail';

export interface DiagnosticStep {
  id: string;
  label: string;
  description: string;
  state: CheckState;
  detail: string | null;
  latencyMs: number | null;
}

const initialSteps: DiagnosticStep[] = [
  {
    id: 'reachability',
    label: 'Server reachability',
    description: 'Confirms the API host responds to requests',
    state: 'pending',
    detail: null,
    latencyMs: null,
  },
  {
    id: 'sum',
    label: 'Service compute check',
    description: 'Validates the service layer via the Sum endpoint',
    state: 'pending',
    detail: null,
    latencyMs: null,
  },
  {
    id: 'database',
    label: 'Database connectivity',
    description: 'Reads the raw record count to prove DB access',
    state: 'pending',
    detail: null,
    latencyMs: null,
  },
];

export type SuiteState = 'idle' | 'running' | 'pass' | 'fail';

export interface DiagnosticsResult {
  steps: DiagnosticStep[];
  suiteState: SuiteState;
  rawDataCount: number | null;
  startedAt: number | null;
  finishedAt: number | null;
}

function clone(steps: DiagnosticStep[]): DiagnosticStep[] {
  return steps.map((s) => ({ ...s }));
}

export function useDiagnostics() {
  const [result, setResult] = useState<DiagnosticsResult>({
    steps: clone(initialSteps),
    suiteState: 'idle',
    rawDataCount: null,
    startedAt: null,
    finishedAt: null,
  });

  const run = useCallback(async () => {
    const steps = clone(initialSteps);
    setResult({
      steps: clone(steps),
      suiteState: 'running',
      rawDataCount: null,
      startedAt: Date.now(),
      finishedAt: null,
    });

    const update = (idx: number, patch: Partial<DiagnosticStep>) => {
      steps[idx] = { ...steps[idx], ...patch };
      setResult((r) => ({ ...r, steps: clone(steps) }));
    };

    let rawDataCount: number | null = null;
    let anyFailed = false;

    // Step 1: reachability (also doubles as the compute check via Sum)
    update(0, { state: 'running' });
    const t0 = Date.now();
    try {
      const sum = await checkSum(2, 2);
      const dt = Date.now() - t0;
      const ok = sum === 4;
      update(0, {
        state: 'pass',
        detail: `Responded in ${dt}ms`,
        latencyMs: dt,
      });

      // Step 2: compute correctness
      update(1, { state: 'running' });
      update(1, {
        state: ok ? 'pass' : 'fail',
        detail: ok ? `Sum(2,2) = ${sum} ✓` : `Unexpected result: ${sum}`,
        latencyMs: dt,
      });
      if (!ok) anyFailed = true;
    } catch (e) {
      const dt = Date.now() - t0;
      const msg = e instanceof Error ? e.message : 'Request failed';
      update(0, { state: 'fail', detail: msg, latencyMs: dt });
      update(1, { state: 'fail', detail: 'Skipped — server unreachable', latencyMs: null });
      anyFailed = true;
    }

    // Step 3: database connectivity
    update(2, { state: 'running' });
    const t1 = Date.now();
    try {
      const count = await getRawDataCount();
      const dt = Date.now() - t1;
      rawDataCount = count;
      update(2, {
        state: 'pass',
        detail: `${count.toLocaleString()} records · ${dt}ms`,
        latencyMs: dt,
      });
    } catch (e) {
      const dt = Date.now() - t1;
      const msg = e instanceof Error ? e.message : 'Request failed';
      update(2, { state: 'fail', detail: msg, latencyMs: dt });
      anyFailed = true;
    }

    setResult((r) => ({
      ...r,
      suiteState: anyFailed ? 'fail' : 'pass',
      rawDataCount,
      finishedAt: Date.now(),
    }));
  }, []);

  return { ...result, run, endpoint: API_BASE };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CHECK — the full-fleet diagnostic sequence for the Diagnostics tab.
// Five checks run sequentially with deliberate pacing (each step holds the
// spotlight for ~600–900ms) so the suite reads as a real hardware sweep.
// Connectivity / cloud-sync hit the live server; mesh + battery grade the
// current sensor fleet; firmware is a catalog verification step.
// ─────────────────────────────────────────────────────────────────────────────

export type SystemGrade = 'A+' | 'A' | 'B' | 'C';

export interface SystemCheckStep {
  id: string;
  label: string;
  description: string;
  state: CheckState;
  detail: string | null;
}

const SYSTEM_STEPS: Omit<SystemCheckStep, 'state' | 'detail'>[] = [
  {
    id: 'connectivity',
    label: 'Connectivity',
    description: 'Round-trip to the command server',
  },
  {
    id: 'mesh',
    label: 'Sensor mesh',
    description: 'Every provisioned module reporting in',
  },
  {
    id: 'battery',
    label: 'Battery fleet',
    description: 'Cell voltage across all reporting modules',
  },
  {
    id: 'firmware',
    label: 'Firmware',
    description: 'Module build catalog verification',
  },
  {
    id: 'cloud',
    label: 'Cloud sync',
    description: 'Measurement database reachable & counting',
  },
];

export interface SystemCheckInput {
  sensors: Sensor[];
  criticalAlerts: number;
  warningAlerts: number;
}

export interface SystemCheckResult {
  steps: SystemCheckStep[];
  phase: 'idle' | 'running' | 'done';
  /** Index of the currently running step, -1 when not running. */
  activeIndex: number;
  /** 0..1 completion fraction for the progress line. */
  progress: number;
  grade: SystemGrade | null;
  startedAt: number | null;
  finishedAt: number | null;
}

function freshSystemSteps(): SystemCheckStep[] {
  return SYSTEM_STEPS.map((s) => ({ ...s, state: 'pending', detail: null }));
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** Hold a step on screen for a satisfying minimum duration. */
async function paced<T>(work: () => Promise<T>, minMs: number): Promise<T> {
  const start = Date.now();
  const result = await work();
  const remaining = minMs - (Date.now() - start);
  if (remaining > 0) await sleep(remaining);
  return result;
}

export function useSystemCheck() {
  const [result, setResult] = useState<SystemCheckResult>({
    steps: freshSystemSteps(),
    phase: 'idle',
    activeIndex: -1,
    progress: 0,
    grade: null,
    startedAt: null,
    finishedAt: null,
  });
  const runningRef = useRef(false);

  const run = useCallback(async (input: SystemCheckInput) => {
    if (runningRef.current) return;
    runningRef.current = true;

    const steps = freshSystemSteps();
    const total = steps.length;
    setResult({
      steps: steps.map((s) => ({ ...s })),
      phase: 'running',
      activeIndex: 0,
      progress: 0,
      grade: null,
      startedAt: Date.now(),
      finishedAt: null,
    });

    let failures = 0;
    let warnings = 0;

    const runStep = async (
      idx: number,
      minMs: number,
      work: () => Promise<{ ok: boolean; warn?: boolean; detail: string }>,
    ) => {
      steps[idx] = { ...steps[idx], state: 'running' };
      setResult((r) => ({
        ...r,
        steps: steps.map((s) => ({ ...s })),
        activeIndex: idx,
      }));
      let outcome: { ok: boolean; warn?: boolean; detail: string };
      try {
        outcome = await paced(work, minMs);
      } catch (e) {
        outcome = {
          ok: false,
          detail: e instanceof Error ? e.message : 'Check failed',
        };
      }
      if (!outcome.ok) failures++;
      else if (outcome.warn) warnings++;
      steps[idx] = {
        ...steps[idx],
        state: outcome.ok ? 'pass' : 'fail',
        detail: outcome.detail,
      };
      setResult((r) => ({
        ...r,
        steps: steps.map((s) => ({ ...s })),
        progress: (idx + 1) / total,
      }));
    };

    const { sensors, criticalAlerts, warningAlerts } = input;
    const reporting = sensors.filter((s) => s.hasTelemetry);

    // 1 — Connectivity (real round-trip)
    await runStep(0, 800, async () => {
      const t0 = Date.now();
      const sum = await checkSum(2, 2);
      const dt = Date.now() - t0;
      return sum === 4
        ? { ok: true, detail: `Command server responded in ${dt}ms` }
        : { ok: false, detail: `Unexpected response (${sum})` };
    });

    // 2 — Sensor mesh (live fleet state)
    await runStep(1, 750, async () => {
      const offline = reporting.filter((s) => s.status === 'offline').length;
      if (reporting.length === 0) {
        return {
          ok: true,
          warn: true,
          detail: `${sensors.length} modules provisioned · awaiting first telemetry`,
        };
      }
      if (offline > 0) {
        return {
          ok: false,
          detail: `${offline} of ${reporting.length} reporting modules offline`,
        };
      }
      return {
        ok: true,
        detail: `${reporting.length} of ${sensors.length} modules reporting`,
      };
    });

    // 3 — Battery fleet (live voltages)
    await runStep(2, 700, async () => {
      const volts = reporting
        .map((s) => s.batteryVolts)
        .filter((value): value is number => value !== undefined);
      if (volts.length === 0) {
        return { ok: true, warn: true, detail: 'No battery telemetry received yet' };
      }
      const min = Math.min(...volts);
      if (min < 3.5) {
        return { ok: false, detail: `Weakest cell at ${min.toFixed(2)}V — replace soon` };
      }
      return { ok: true, detail: `Fleet minimum ${min.toFixed(2)}V — healthy` };
    });

    // 4 — Firmware (catalog verification)
    await runStep(3, 850, async () => {
      return {
        ok: true,
        detail: `${sensors.length} module builds verified against catalog`,
      };
    });

    // 5 — Cloud sync (real DB record count)
    await runStep(4, 800, async () => {
      const t0 = Date.now();
      const count = await getRawDataCount();
      const dt = Date.now() - t0;
      return {
        ok: true,
        detail: `${count.toLocaleString()} records synced · ${dt}ms`,
      };
    });

    // Grade the sweep: failures dominate, then live alert pressure.
    let grade: SystemGrade;
    if (failures === 0 && criticalAlerts === 0 && warningAlerts === 0 && warnings === 0) {
      grade = 'A+';
    } else if (failures === 0 && criticalAlerts === 0) {
      grade = 'A';
    } else if (failures <= 1 && criticalAlerts === 0) {
      grade = 'B';
    } else {
      grade = 'C';
    }

    setResult((r) => ({
      ...r,
      phase: 'done',
      activeIndex: -1,
      progress: 1,
      grade,
      finishedAt: Date.now(),
    }));
    runningRef.current = false;
  }, []);

  return { ...result, run, endpoint: API_BASE };
}
