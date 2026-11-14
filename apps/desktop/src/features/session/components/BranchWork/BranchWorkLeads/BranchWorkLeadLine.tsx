import type { MountId } from '@goodboy/types';
import { Button, formatUsd, InteractiveRow, StateDot } from '@goodboy/ui';
import type { BranchLead } from '../../../branchLeadsOf';

type MountParams = {
  readonly mountId: MountId;
};

type Props = {
  readonly lead: BranchLead;
  readonly canOpenBranch: (params: MountParams) => boolean;
  readonly onOpen: () => void;
  readonly onOpenBranch: (params: MountParams) => void;
};

const ALSO_ON_CLASS = 'min-w-0 shrink truncate text-meta text-muted-foreground';

export const BranchWorkLeadLine = ({ lead, canOpenBranch, onOpen, onOpenBranch }: Props) => (
  <div data-testid="branch-work-lead" data-lead-id={lead.id}>
    <InteractiveRow
      label={`Auto ${lead.title}, ${lead.stateWord}`}
      isSelected={false}
      onOpen={onOpen}
      className="flex min-h-8 min-w-0 items-center gap-2 px-2"
    >
      <StateDot state={lead.dot} label={lead.stateWord} isLive={lead.dot === 'running'} />
      <span className="shrink-0 text-meta text-muted-foreground">Auto</span>
      <span className="min-w-0 truncate text-row text-foreground">{lead.title}</span>
      <span className="shrink-0 text-meta text-muted-foreground">{lead.stateWord}</span>
      <span className="min-w-0 flex-1" />
      {lead.alsoOn.map((other) =>
        canOpenBranch({ mountId: other.mountId }) ? (
          <Button
            key={other.mountId}
            variant="quiet"
            size="xs"
            data-testid="lead-also-on"
            onClick={() => onOpenBranch({ mountId: other.mountId })}
          >
            also on {other.branch}
          </Button>
        ) : (
          <span key={other.mountId} data-testid="lead-also-on" className={ALSO_ON_CLASS}>
            also on {other.branch}
          </span>
        ),
      )}
      {lead.spendUsd > 0 ? (
        <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
          {formatUsd(lead.spendUsd)} here
        </span>
      ) : null}
    </InteractiveRow>
  </div>
);
