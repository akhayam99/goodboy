import type { ResolveAttempt } from '@goodboy/types';

export const launchKeyOf = ({ attempt }: { readonly attempt: ResolveAttempt }): string =>
  attempt.launchId ?? attempt.batchId ?? `agent:${attempt.agentId}`;

export const attemptsOfLaunch = ({
  attempts,
  launchKey,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly launchKey: string;
}): ReadonlyArray<ResolveAttempt> =>
  attempts.filter((attempt) => launchKeyOf({ attempt }) === launchKey);
