import { useCallback, useState } from 'react';
import { API_BASE, checkSum, getRawDataCount } from './api';

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
