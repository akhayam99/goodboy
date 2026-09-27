import { invoke } from '@tauri-apps/api/core';

export type LastCrashSource = 'window' | 'promise' | 'rust';

export type LastCrash = {
  readonly source: LastCrashSource;
  readonly message: string;
  readonly stack: string;
  readonly screen: string | null;
  readonly appVersion: string;
  readonly actions: ReadonlyArray<string>;
  readonly occurredAt: number;
};

export type LastCrashInput = {
  readonly source: Exclude<LastCrashSource, 'rust'>;
  readonly message: string;
  readonly stack: string;
  readonly screen: string | null;
  readonly actions: ReadonlyArray<string>;
};

export const writeLastCrash = async (crash: LastCrashInput): Promise<void> => {
  try {
    await invoke('last_crash_write', { crash });
  } catch {
    return;
  }
};

export const claimLastCrash = async (): Promise<LastCrash | null> => {
  try {
    return (await invoke<LastCrash | null>('last_crash_claim')) ?? null;
  } catch {
    return null;
  }
};

export const deleteLastCrash = async (): Promise<void> => {
  try {
    await invoke('last_crash_delete');
  } catch {
    return;
  }
};
