import { invokeCommand } from '../../shared/lib/invokeCommand';

export type LastCrashSource = 'window' | 'promise' | 'rust';

export type LastCrashKind = 'panic' | 'error';

export type LastCrash = {
  readonly kind: LastCrashKind;
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

export const LAST_CRASH_TITLE: Readonly<Record<LastCrashKind, string>> = {
  panic: 'Goodboy closed unexpectedly last time',
  error: 'Goodboy hit an error last time',
};

export const writeLastCrash = async (crash: LastCrashInput): Promise<void> => {
  try {
    await invokeCommand('last_crash_write', { crash });
  } catch {
    return;
  }
};

export const claimLastCrash = async (): Promise<LastCrash | null> => {
  try {
    return (await invokeCommand<LastCrash | null>('last_crash_claim')) ?? null;
  } catch {
    return null;
  }
};

export const deleteLastCrash = async (): Promise<void> => {
  try {
    await invokeCommand('last_crash_delete');
  } catch {
    return;
  }
};
