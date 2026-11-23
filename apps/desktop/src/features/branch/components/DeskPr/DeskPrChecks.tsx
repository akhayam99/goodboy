import type { ReviewSourceKind } from '@goodboy/core/review-source';
import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { isFailingConclusion } from '../../../integrations/github/checksRollup';
import { DeskCheckLog } from './DeskCheckLog';
import type { RenderPrChecks } from './types';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly check: string | null;
  readonly prUrl: string;
  readonly host: ReviewSourceKind;
  readonly isLoading: boolean;
  readonly renderChecks: RenderPrChecks;
};

export const DeskPrChecks = ({
  sessionId,
  mountId,
  checks,
  check,
  prUrl,
  host,
  isLoading,
  renderChecks,
}: Props) => {
  const failing = checks.filter((run) => isFailingConclusion({ conclusion: run.conclusion }));
  const focused = failing.find((run) => run.name === check) ?? failing[0] ?? null;
  return (
    <div data-desk-pr-checks="" className="flex min-w-0 flex-col gap-4">
      {focused === null ? null : (
        <DeskCheckLog
          key={focused.name}
          sessionId={sessionId}
          mountId={mountId}
          name={focused.name}
          url={focused.detailsUrl}
        />
      )}
      {renderChecks({ sessionId, checks, fallbackUrl: prUrl, host, isLoading })}
    </div>
  );
};
