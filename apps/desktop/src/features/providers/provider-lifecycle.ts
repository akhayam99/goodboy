import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  PROVIDER_LIFECYCLE_COMMANDS,
  type ProviderId,
  type ProviderLifecycleAction,
  type ProviderPlatform,
} from '@goodboy/types';
import type { AuthState, ProviderStatus } from './providers';

export type LifecycleOutputPayload = {
  readonly runId: string;
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly data: string;
};

export type LifecycleExitPayload = {
  readonly runId: string;
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly exitCode: number;
  readonly status: ProviderStatus;
  readonly auth: AuthState;
};

export const currentPlatform = (): ProviderPlatform => {
  if (typeof navigator === 'undefined') {
    return 'linux';
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) {
    return 'darwin';
  }
  if (ua.includes('win')) {
    return 'win32';
  }
  return 'linux';
};

export const resolveLifecycleCommand = (
  providerId: ProviderId,
  action: ProviderLifecycleAction,
  platform: ProviderPlatform = currentPlatform(),
): string => {
  const entry = PROVIDER_LIFECYCLE_COMMANDS[providerId];
  if (entry === undefined) {
    throw new Error(`no lifecycle commands for provider: ${providerId}`);
  }
  if (action === 'install') {
    return entry.install[platform];
  }
  const command = entry[action];
  if (command === undefined) {
    throw new Error(`no ${action} command for provider: ${providerId}`);
  }
  return command;
};

export const invokeProviderLifecycleRun = (args: {
  providerId: ProviderId;
  action: ProviderLifecycleAction;
  command: string;
  runId: string;
  cols: number;
  rows: number;
  env?: Readonly<Record<string, string>>;
}): Promise<void> => {
  return invoke<void>('provider_lifecycle_run', args);
};

export const invokeProviderLifecycleWrite = (runId: string, data: string): Promise<void> => {
  return invoke<void>('provider_lifecycle_write', { runId, data });
};

export const invokeProviderLifecycleResize = (
  runId: string,
  cols: number,
  rows: number,
): Promise<void> => {
  return invoke<void>('provider_lifecycle_resize', { runId, cols, rows });
};

export const invokeProviderLifecycleCancel = (runId: string): Promise<void> => {
  return invoke<void>('provider_lifecycle_cancel', { runId });
};

export const listenLifecycleOutput = (
  handler: (payload: LifecycleOutputPayload) => void,
): Promise<UnlistenFn> => {
  return listen<LifecycleOutputPayload>('provider-lifecycle-output', (e) => handler(e.payload));
};

export const listenLifecycleExit = (
  handler: (payload: LifecycleExitPayload) => void,
): Promise<UnlistenFn> => {
  return listen<LifecycleExitPayload>('provider-lifecycle-exit', (e) => handler(e.payload));
};
