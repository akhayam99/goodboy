import { cleanCliVersion } from '@goodboy/core';
import type { ProviderStatus } from './providers';

export type CliUpdateResult = {
  readonly outcome: 'updated' | 'unchanged';
  readonly before: string | null;
  readonly after: string | null;
  readonly binaryPath: string | null;
};

export const cliUpdateResultOf = ({
  before,
  status,
}: {
  readonly before: string | null;
  readonly status: ProviderStatus;
}): CliUpdateResult => {
  const after = cleanCliVersion({ raw: status.version });
  return {
    outcome: after !== null && after !== before ? 'updated' : 'unchanged',
    before,
    after,
    binaryPath: status.path ?? null,
  };
};
