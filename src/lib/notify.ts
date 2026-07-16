import { useEffect, useState } from 'react';

// Lightweight global toast/notification system used to surface the outcome of
// long-running operations (sensor toggles, config pushes, profile saves,
// connectivity recovery, etc.). A single host renders the queue; any module
// can fire a notification without prop drilling.

export type NotifyKind = 'success' | 'error' | 'info' | 'pending';

export interface Toast {
  id: string;
  kind: NotifyKind;
  title: string;
  message?: string;
  /** ms before auto-dismiss; 0 = sticky until manually replaced/dismissed */
  duration: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

export function dismissToast(id: string) {
  clearTimer(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

interface NotifyOptions {
  message?: string;
  duration?: number;
  /** Reuse an existing toast id to update it in place (e.g. pending -> success) */
  id?: string;
}

const defaultDurations: Record<NotifyKind, number> = {
  success: 2600,
  error: 4000,
  info: 2600,
  pending: 0,
};

export function notify(kind: NotifyKind, title: string, opts: NotifyOptions = {}): string {
  const id = opts.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const duration = opts.duration ?? defaultDurations[kind];

  const toast: Toast = { id, kind, title, message: opts.message, duration };

  clearTimer(id);
  const existingIndex = toasts.findIndex((t) => t.id === id);
  if (existingIndex >= 0) {
    toasts = toasts.map((t) => (t.id === id ? toast : t));
  } else {
    // Cap the visible stack to the 3 most recent.
    toasts = [...toasts, toast].slice(-3);
  }
  emit();

  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration),
    );
  }
  return id;
}

// Convenience helpers
export const notifySuccess = (title: string, message?: string) =>
  notify('success', title, { message });
export const notifyError = (title: string, message?: string) =>
  notify('error', title, { message });
export const notifyInfo = (title: string, message?: string) =>
  notify('info', title, { message });

/**
 * Wrap an async task with pending -> success/error notifications.
 * Returns the task's resolved value, re-throws on failure.
 */
export async function withNotify<T>(
  task: () => Promise<T>,
  labels: { pending: string; success: string; error?: string },
): Promise<T> {
  const id = notify('pending', labels.pending);
  try {
    const result = await task();
    notify('success', labels.success, { id });
    return result;
  } catch (e) {
    notify('error', labels.error ?? 'Something went wrong', {
      id,
      message: e instanceof Error ? e.message : undefined,
    });
    throw e;
  }
}

export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    const listener: Listener = (next) => setList(next);
    listeners.add(listener);
    setList([...toasts]);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return list;
}
