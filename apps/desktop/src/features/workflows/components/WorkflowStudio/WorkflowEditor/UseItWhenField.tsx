import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { usePolish } from '../../../hooks/usePolish';
import { useProsePolishDeps } from '../../../hooks/useProsePolishDeps';
import { polishWorkflowGoalText } from '../../../workflows';
import { GoalField } from './GoalField';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly value: string;
  readonly isDisabled: boolean;
  readonly onChange: (value: string) => void;
};

const POLISH_ID = 'use-it-when';

export const UseItWhenField = ({ workspaceId, workingDir, value, isDisabled, onChange }: Props) => {
  const polishDeps = useProsePolishDeps({ workspaceId, workingDir });
  const [, setPolishError] = useState<string | null>(null);
  const polish = usePolish({ onError: setPolishError });
  return (
    <WorkflowSection label="Use it when" help="Say what kind of task this workflow fits.">
      <GoalField
        label="Use it when"
        id="workflow-use-it-when"
        value={value}
        placeholder="The task names a test that fails some of the time"
        hasSessionGoal={false}
        isSessionGoal={false}
        canUndo={polish.canUndo({ id: POLISH_ID, current: value })}
        isPolishing={polish.polishingId === POLISH_ID}
        disabled={isDisabled}
        onChange={onChange}
        onBlur={() => {}}
        onUseSessionGoal={() => {}}
        onUndo={() => polish.undo({ id: POLISH_ID, current: value, apply: onChange })}
        onPolish={() =>
          void polish.run({
            id: POLISH_ID,
            current: value,
            keptMessage: "Kept your wording. It couldn't be polished.",
            polish: () => polishWorkflowGoalText({ deps: polishDeps, goal: value }),
            apply: onChange,
          })
        }
      />
    </WorkflowSection>
  );
};
