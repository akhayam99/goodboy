import type { ReactNode } from 'react';
import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';
import { PrChecks } from '../../../../integrations/github/components/PullRequest/PrChecks';

type Props = {
  readonly renderCheckActions?: (check: PrCheckRun) => ReactNode;
  readonly renderCheckHint?: (check: PrCheckRun) => ReactNode;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly hostLabel: string;
  readonly isLoading?: boolean;
  readonly pr?: PullRequestState;
  readonly detail?: PrDetail | null;
  readonly onOpenUrl: (url: string) => void;
};

export const ChecksMode = ({
  renderCheckActions,
  renderCheckHint,
  checks,
  fallbackUrl,
  hostLabel,
  isLoading,
  pr,
  detail,
  onOpenUrl,
}: Props) => (
  <section aria-label="Checks" className="flex flex-col gap-3">
    <PrChecks
      renderCheckActions={renderCheckActions}
      renderCheckHint={renderCheckHint}
      checks={checks}
      fallbackUrl={fallbackUrl}
      hostLabel={hostLabel}
      isLoading={isLoading}
      pr={pr}
      detail={detail}
      onOpenUrl={onOpenUrl}
    />
  </section>
);
