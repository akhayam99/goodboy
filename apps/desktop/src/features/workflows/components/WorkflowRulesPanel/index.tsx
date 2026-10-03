import { Check } from 'lucide-react';
import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useWorkflowRules, type WorkflowRulesSaveState } from '../../hooks/useWorkflowRules';
import { RulesAutonomyBand } from './RulesAutonomyBand';
import { RulesProvidersBand } from './RulesProvidersBand';
import { RulesSpendBand } from './RulesSpendBand';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const SAVE_LABEL: Readonly<Record<WorkflowRulesSaveState, string | null>> = {
  idle: null,
  saving: 'Saving…',
  saved: 'Saved',
  failed: "Couldn't save",
};

export const WorkflowRulesPanel = ({ workspaceId }: Props) => {
  const { rules, saveState, patch } = useWorkflowRules({ workspaceId });
  const reportError = useAppStore((state) => state.reportError);
  const save = (next: Partial<WorkflowRules>) => {
    void patch(next).catch((error: unknown) => {
      void reportError({ title: "Couldn't save the workflow rules", error, workspaceId });
    });
  };
  const saveLabel = SAVE_LABEL[saveState];
  return (
    <div data-testid="workflow-rules" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-secondary text-muted-foreground">
          New runs start from these rules. A run keeps the copy it started with.
        </p>
        {saveLabel === null ? null : (
          <span
            role="status"
            className="inline-flex shrink-0 items-center gap-1 text-secondary text-muted-foreground"
          >
            {saveState === 'saved' ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
            {saveLabel}
          </span>
        )}
      </div>
      <RulesProvidersBand
        workspaceId={workspaceId}
        spread={rules.spreadByHeadroom}
        onSpread={(spreadByHeadroom) => save({ spreadByHeadroom })}
      />
      <RulesAutonomyBand autonomy={rules.autonomy} onChange={(autonomy) => save({ autonomy })} />
      <RulesSpendBand rules={rules} onChange={save} />
    </div>
  );
};
