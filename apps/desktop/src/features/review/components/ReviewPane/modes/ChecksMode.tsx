import type { PrCheckRun } from '@goodboy/types';
import {
  PrChecks,
  type RenderCheckRow,
} from '../../../../integrations/github/components/PullRequest/PrChecks';

type Props = {
  readonly renderCheckRow?: RenderCheckRow;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly hostLabel: string;
  readonly isLoading?: boolean;
  readonly onOpenUrl: (url: string) => void;
};

export const ChecksMode = ({
  renderCheckRow,
  checks,
  fallbackUrl,
  hostLabel,
  isLoading,
  onOpenUrl,
}: Props) => (
  <section aria-label="Checks" className="flex flex-col gap-3">
    <PrChecks
      renderCheckRow={renderCheckRow}
      checks={checks}
      fallbackUrl={fallbackUrl}
      hostLabel={hostLabel}
      isLoading={isLoading}
      onOpenUrl={onOpenUrl}
    />
  </section>
);
