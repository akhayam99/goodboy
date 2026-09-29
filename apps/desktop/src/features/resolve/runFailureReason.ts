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

const reasonForError = ({ error }: { readonly error: string }): string =>
  reasonForCode({ code: error }) ?? `The run failed: ${error}`;

export const runFailureReason = ({ thread, attempt }: Params): string => {
  const stateCode = (thread.stateReason ?? '').replace(STATE_PREFIX, '');
  const error = attempt?.error?.trim() ?? '';
  const isSpecificError = error !== '' && error !== 'interrupted';
  if (stateCode === 'interrupted' && isSpecificError) {
    return reasonForError({ error });
  }
  const fromState = reasonForCode({ code: stateCode });
  if (fromState !== null) {
    return fromState;
  }
  if (error !== '') {
    return reasonForError({ error });
  }
  return 'The run failed and no reason was recorded';
};

export const attemptFailureReason = ({ attempt }: { readonly attempt: ResolveAttempt }): string => {
  const error = attempt.error?.trim() ?? '';
  if (error !== '') {
    return reasonForError({ error });
  }
  return attempt.phase === 'cancelled'
    ? 'The run was stopped'
    : 'The run failed and no reason was recorded';
};
