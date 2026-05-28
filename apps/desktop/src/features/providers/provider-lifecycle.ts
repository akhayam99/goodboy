import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  PROVIDER_LIFECYCLE_COMMANDS,
  type ProviderId,
  type ProviderLifecycleAction,
  type ProviderPlatform,
} from '@goodboy/types';
import type { AuthState, ProviderStatus } from './providers';

export interface LifecycleOutputPayload {
  readonly runId: string;
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly data: string;
}

export interface LifecycleExitPayload {
  readonly runId: string;
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly exitCode: number;
  readonly status: ProviderStatus;
  readonly auth: AuthState;
}

// Resolve the platform once per process. Tauri runs on darwin/linux/win32 only;
// anything else falls back to linux because the npm commands are identical.
export function currentPlatform(): ProviderPlatform {
  if (typeof navigator === 'undefined') return 'linux';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('win')) return 'win32';
  return 'linux';
}

export function resolveLifecycleCommand(
  providerId: ProviderId,
  action: ProviderLifecycleAction,
  platform: ProviderPlatform = currentPlatform(),
): string {
  const entry = PROVIDER_LIFECYCLE_COMMANDS[providerId];
  if (action === 'install') return entry.install[platform];
  return entry[action];
}

export function invokeProviderLifecycleRun(args: {
  providerId: ProviderId;
  action: ProviderLifecycleAction;
  command: string;
  runId: string;
  cols: number;
  rows: number;
}): Promise<void> {
  return invoke<void>('provider_lifecycle_run', args);
}

export function invokeProviderLifecycleWrite(runId: string, data: string): Promise<void> {
  return invoke<void>('provider_lifecycle_write', { runId, data });
}

export function invokeProviderLifecycleResize(
  runId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke<void>('provider_lifecycle_resize', { runId, cols, rows });
}

export function invokeProviderLifecycleCancel(runId: string): Promise<void> {
  return invoke<void>('provider_lifecycle_cancel', { runId });
}

export function listenLifecycleOutput(
  handler: (payload: LifecycleOutputPayload) => void,
): Promise<UnlistenFn> {
  return listen<LifecycleOutputPayload>('provider-lifecycle-output', (e) => handler(e.payload));
}

export function listenLifecycleExit(
  handler: (payload: LifecycleExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<LifecycleExitPayload>('provider-lifecycle-exit', (e) => handler(e.payload));
}
