import type { ResolveFailureCause } from '@goodboy/types';

export class ResolveFailure extends Error {
  readonly failureCause: ResolveFailureCause;

  constructor({
    failureCause,
    message,
  }: {
    readonly failureCause: ResolveFailureCause;
    readonly message: string;
  }) {
    super(message);
    this.name = 'ResolveFailure';
    this.failureCause = failureCause;
  }
}

export const failureCauseOfError = ({ error }: { readonly error: unknown }): ResolveFailureCause =>
  error instanceof ResolveFailure ? error.failureCause : 'start_failed';
