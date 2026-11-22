import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { openLink } from '../../../open/openLink';
import { isFailingConclusion } from '../../../integrations/github/checksRollup';
import { PrChecks } from '../../../integrations/github/components/PullRequest/PrChecks';
import { DeskCheckLog } from './DeskCheckLog';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly check: string | null;
  readonly prUrl: string;
  readonly isLoading: boolean;
};

export const DeskPrChecks = ({ sessionId, mountId, checks, check, prUrl, isLoading }: Props) => {
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
      <PrChecks
        checks={checks}
        fallbackUrl={prUrl}
        host="github"
        isLoading={isLoading}
        onOpenUrl={(url) => openLink({ url, sessionId })}
      />
    </div>
  );
};
