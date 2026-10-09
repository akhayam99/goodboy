import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useWorkflowRules } from '../../hooks/useWorkflowRules';
import { RulesAutonomyBand } from './RulesAutonomyBand';
import { RulesGuidanceBand } from './RulesGuidanceBand';
import { RulesProvidersBand } from './RulesProvidersBand';
import { RulesSpendBand } from './RulesSpendBand';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkflowRulesPanel = ({ workspaceId }: Props) => {
  const { rules, patch } = useWorkflowRules({ workspaceId });
  const reportError = useAppStore((state) => state.reportError);
  const save = (next: Partial<WorkflowRules>) => {
    void patch(next).catch((error: unknown) => {
      void reportError({ title: "Couldn't save the workflow rules", error, workspaceId });
    });
  };
  return (
    <div data-testid="workflow-rules" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-title">Run defaults</h2>
        <p className="text-body text-muted-foreground">Each run keeps its own copy.</p>
      </div>
      <RulesAutonomyBand autonomy={rules.autonomy} onChange={(autonomy) => save({ autonomy })} />
      <RulesSpendBand rules={rules} onChange={save} />
      <RulesProvidersBand workspaceId={workspaceId} />
      <RulesGuidanceBand workspaceId={workspaceId} rules={rules} onChange={save} />
    </div>
  );
};
