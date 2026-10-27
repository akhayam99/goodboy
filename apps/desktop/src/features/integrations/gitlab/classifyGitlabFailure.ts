import { CommandError } from '../../../shared/lib/invokeCommand';
import type { HostFailureKind } from '../../../shared/lib/hostFailure';

export type GitlabFailure = {
  readonly kind: HostFailureKind;
  readonly body: string;
};

export const gitlabFailureOf = ({ error }: { readonly error: unknown }): GitlabFailure => {
  if (error instanceof CommandError) {
    return {
      kind: error.failure?.kind ?? 'failed',
      body: error.failure?.detail ?? error.message,
    };
  }
  return { kind: 'failed', body: error instanceof Error ? error.message : String(error) };
};
