import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { Band, BandRow, Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { openWorkflowRules } from '../../../workflows/openWorkflowRules';
import { workflowRulesSummary } from '../../../workflows/workflowRulesCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly requestClose: () => void;
};

export const WorkflowRulesPage = ({ workspaceId, requestClose }: Props) => {
  const rules = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.workflowRules ?? DEFAULT_WORKFLOW_RULES,
  );
  return (
    <Band label="Workflow rules" ariaLabel="Workflow rules" headingLevel={2}>
      <BandRow>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-foreground">{workflowRulesSummary({ rules })}</span>
          <span className="text-secondary text-muted-foreground">
            Edited in the Rules tab of Workflows.
          </span>
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            openWorkflowRules();
            requestClose();
          }}
        >
          Open Rules
        </Button>
      </BandRow>
    </Band>
  );
};
