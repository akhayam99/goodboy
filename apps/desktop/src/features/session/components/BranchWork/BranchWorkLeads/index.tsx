import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { treeIndentPx } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../../../store';
import { LeadTree } from '../../../../auto/tree/LeadTree';
import { useCanOpenBranchWork } from '../../../hooks/useCanOpenBranchWork';
import { openBranchWorkTab } from '../../../openBranchWorkTab';
import type { BranchLead } from '../../../branchLeadsOf';
import { BranchWorkLeadLine } from './BranchWorkLeadLine';

type Props = {
  readonly sessionId: SessionId;
  readonly leads: ReadonlyArray<BranchLead>;
  readonly onToggleFold: (foldId: string) => void;
  readonly onLeave: () => void;
};

type OpenParams = {
  readonly agentId: AgentId;
};

type BranchParams = {
  readonly mountId: MountId;
};

const ignore = (): void => undefined;

export const BranchWorkLeads = ({ sessionId, leads, onToggleFold, onLeave }: Props) => {
  const canOpenBranch = useCanOpenBranchWork({ sessionId });
  const open = ({ agentId }: OpenParams) => {
    useAppStore.getState().navigate({ to: agentPlace({ sessionId, agentId }) });
    onLeave();
  };
  const openBranch = ({ mountId }: BranchParams) => openBranchWorkTab({ sessionId, mountId });
  return (
    <section aria-labelledby="branch-work-leads" className="flex min-w-0 flex-col gap-1">
      <h2 id="branch-work-leads" className="text-row-strong text-foreground">
        Leads
      </h2>
      {leads.map((lead) => (
        <div key={lead.id} className="flex min-w-0 flex-col gap-0.5">
          <BranchWorkLeadLine
            lead={lead}
            canOpenBranch={canOpenBranch}
            onOpen={() => open({ agentId: lead.agentId })}
            onOpenBranch={openBranch}
          />
          {lead.items.length === 0 ? null : (
            <div style={{ paddingLeft: treeIndentPx({ depth: 2 }) }}>
              <LeadTree
                items={lead.items}
                selectedAgentId={null}
                density="compact"
                onSelect={() => open({ agentId: lead.agentId })}
                onToggleFold={onToggleFold}
                onEditNote={ignore}
                onRemoveNote={ignore}
              />
            </div>
          )}
        </div>
      ))}
    </section>
  );
};
