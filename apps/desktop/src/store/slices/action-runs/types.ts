export type { GetFn, SetFn } from '../../slice-types';

export type ActionRunPhase = 'pending' | 'done' | 'failed';

export type ActionRun = {
  readonly key: string;
  readonly actionId: string;
  readonly choice: string | null;
  readonly phase: ActionRunPhase;
  readonly message: string | null;
  readonly error: unknown;
  readonly startedAt: number;
  readonly token: number;
};

export type ActionRunResult =
  | { readonly kind: 'done'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string; readonly error: unknown }
  | { readonly kind: 'silent' };

export type ActionRunKeyParams = {
  readonly key: string;
};

export type ClaimActionRunParams = ActionRunKeyParams & {
  readonly actionId: string;
  readonly choice: string | null;
};

export type FinishActionRunParams = ActionRunKeyParams & {
  readonly token: number;
  readonly result: ActionRunResult;
};

export type RunActionParams = ClaimActionRunParams & {
  readonly task: () => Promise<string | null>;
};

export type RunActionStatus = 'busy' | 'applied' | 'stale';
