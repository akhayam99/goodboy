import type { SessionId } from '@goodboy/types';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { StartRowContent } from './StartRowContent';

type Props = {
  readonly sessionId: SessionId;
  readonly onOpenWorkflowBuilder: () => void;
};

const START_ROW =
  'group flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated px-3.5 py-3 text-left shadow-sm transition-colors hover:border-border';

export const ActivityEmptyState = ({ sessionId, onOpenWorkflowBuilder }: Props) => (
  <div className="flex flex-col gap-3 rounded-lg bg-muted/20 px-4 py-3.5">
    <p className="text-sm leading-relaxed text-muted-foreground">
      Nothing has run in this session yet. Attach a workflow for a multi-step task, or spawn a
      single agent when one pass is enough.
    </p>
    <div className="flex flex-col gap-2">
      <button type="button" onClick={onOpenWorkflowBuilder} className={START_ROW}>
        <StartRowContent
          icon={SECTION_ICONS.workflows}
          tone="accent"
          label="Workflow"
          description="Runs a multi-step pipeline: scout, plan, implement, test, review."
        />
      </button>
      <CreateAgentPopover
        sessionId={sessionId}
        className={START_ROW}
        description="Spawns one agent on a single task, with the shared session context."
      />
    </div>
  </div>
);
