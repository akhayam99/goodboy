import type { FixRunReady } from './fixRunReady';
import { countNoun } from '../../shared/utils/countNoun';

type CountParams = {
  readonly count: number;
};

export const fixRunReadyTitle = ({ count }: CountParams): string =>
  `Fix run finished: ${countNoun({ count: count, one: 'fix', many: 'fixes' })} ready for you`;

type BodyParams = {
  readonly ready: FixRunReady;
  readonly provider: string;
  readonly canResolve: boolean;
};

const commitsPart = ({ commits }: Pick<FixRunReady, 'commits'>): string =>
  commits.length === 1
    ? `the fix made in ${commits[0]}`
    : `the fixes made in ${commits.length} commits`;

const threadsPart = ({
  count,
  provider,
  canResolve,
}: CountParams & Pick<BodyParams, 'provider' | 'canResolve'>): string => {
  const threads = count === 1 ? 'the comment' : `the ${count} comments`;
  return `replies to ${canResolve ? 'and resolves ' : ''}${threads} on ${provider}`;
};

export const fixRunReadyBody = ({ ready, provider, canResolve }: BodyParams): string => {
  const accepted = `Apply accepts ${commitsPart({ commits: ready.commits })}.`;
  if (ready.hostThreadCount === 0) {
    return `${accepted} The next push sends it.`;
  }
  return `${accepted} The next push sends it and ${threadsPart({ count: ready.hostThreadCount, provider, canResolve })}.`;
};

export const FIX_RUN_READY_LABEL = {
  region: 'Fix run result',
} as const;
