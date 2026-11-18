import { Markdown, TEXT_ROLE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { routingShortText } from '../../../shared/components/RoutingPicker/routingSummary';
import { useKindRouting } from '../../../shared/hooks/useKindRouting';
import type { ProposalOptions } from '../checks/proposalOptionsOf';
import { ProposedFix, type StartParams } from './CheckAnalysisDrawer/ProposedFix';

type Props = {
  readonly sessionId: SessionId;
  readonly hintScope: string;
  readonly checkName: string;
  readonly finding: string;
  readonly proposal: string;
  readonly options: ProposalOptions | null;
  readonly isStarting: boolean;
  readonly onStart: (params: StartParams) => void;
  readonly onDismiss: () => void;
};

const HEADING = cn('text-meta', TEXT_ROLE.hint);

export const CheckProposalInline = ({
  sessionId,
  hintScope,
  checkName,
  finding,
  proposal,
  options,
  isStarting,
  onStart,
  onDismiss,
}: Props) => {
  const routing = useKindRouting({ sessionId, kind: 'implementer' });
  return (
    <section
      aria-label={`Proposed fix for ${checkName}`}
      data-check-proposal=""
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-3"
    >
      {finding.length === 0 || finding === proposal ? null : (
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={HEADING}>What failed</h3>
          <Markdown text={finding} />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className={HEADING}>Proposed fix</h3>
        <ProposedFix
          sessionId={sessionId}
          hintScope={hintScope}
          proposal={proposal}
          options={options}
          isActionable
          isStarting={isStarting}
          isInline
          routing={routingShortText(routing)}
          onStart={onStart}
          onDismiss={onDismiss}
        />
      </div>
    </section>
  );
};
