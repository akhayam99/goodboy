import type { ReviewSourceKind } from '@goodboy/core';
import type { PrCheckRun } from '@goodboy/types';
import {
  PrChecks,
  type RenderCheckRow,
} from '../../../../integrations/github/components/PullRequest/PrChecks';

type Props = {
  readonly renderCheckRow?: RenderCheckRow;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly host: ReviewSourceKind;
  readonly isLoading?: boolean;
  readonly onOpenUrl: (url: string) => void;
};

export const ChecksMode = ({
  renderCheckRow,
  checks,
  fallbackUrl,
  host,
  isLoading,
  onOpenUrl,
}: Props) => (
  <section aria-label="Checks" className="flex flex-col gap-3">
    <PrChecks
      renderCheckRow={renderCheckRow}
      checks={checks}
      fallbackUrl={fallbackUrl}
      host={host}
      isLoading={isLoading}
      onOpenUrl={onOpenUrl}
    />
  </section>
);
