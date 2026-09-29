import type { ResolveAttempt, ResolveThread } from '@goodboy/types';

type Params = {
  readonly thread: ResolveThread;
  readonly attempt: ResolveAttempt | null;
};

const STATE_PREFIX = /^(?:failed|stopped):/;

const reasonForCode = ({ code }: { readonly code: string }): string | null => {
  if (code === 'interrupted') {
    return 'The run ended before the resolver reported a result';
  }
  if (code.startsWith('missing_result')) {
    return 'The resolver finished without reporting a result for this thread';
  }
  if (code === 'target_unresolved') {
    return 'The worktree for this thread is no longer available';
  }
  return null;
};

export const runFailureReason = ({ thread, attempt }: Params): string => {
  const stateCode = (thread.stateReason ?? '').replace(STATE_PREFIX, '');
  const fromState = reasonForCode({ code: stateCode });
  if (fromState !== null) {
    return fromState;
  }
  const error = attempt?.error?.trim() ?? '';
  if (error !== '') {
    return reasonForCode({ code: error }) ?? `The run failed: ${error}`;
  }
  return 'The run failed and no reason was recorded';
};
