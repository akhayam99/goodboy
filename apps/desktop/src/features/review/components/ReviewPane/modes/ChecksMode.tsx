import type { PrCheckRun } from '@goodboy/types';
import { PrChecks } from '../../../../github/components/PullRequest/PrChecks';

type Props = {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly onOpenUrl: (url: string) => void;
};

export const ChecksMode = ({ checks, fallbackUrl, onOpenUrl }: Props) => (
  <section aria-label="Checks" className="flex flex-col gap-6">
    <PrChecks checks={checks} fallbackUrl={fallbackUrl} hostLabel="GitHub" onOpenUrl={onOpenUrl} />
  </section>
);
