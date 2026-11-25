import type { Workflow, WorkspaceId } from '@goodboy/types';
import type { WorkflowDraft } from '../../../engine';
import { GuideTextField } from './GuideTextField';
import { NameField } from './NameField';
import { ThenSuggestField } from './ThenSuggestField';
import { UseItWhenField } from './UseItWhenField';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly form: WorkflowDraft;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly selfId: Workflow['id'] | null;
  readonly isNew: boolean;
  readonly nameError: string | null;
  readonly isLocked: boolean;
  readonly onChange: (patch: Partial<WorkflowDraft>) => void;
};

export const GuideFields = ({
  workspaceId,
  workingDir,
  form,
  workflows,
  selfId,
  isNew,
  nameError,
  isLocked,
  onChange,
}: Props) => (
  <>
    {isNew ? (
      <NameField
        value={form.name}
        error={nameError}
        isDisabled={isLocked}
        onChange={(name) => onChange({ name })}
      />
    ) : null}
    <UseItWhenField
      workspaceId={workspaceId}
      workingDir={workingDir}
      value={form.description}
      isDisabled={isLocked}
      onChange={(description) => onChange({ description })}
    />
    <GuideTextField
      id="workflow-first-check"
      label="First, check"
      help="What the Lead confirms before it starts."
      placeholder="Run the test ten times and confirm it fails at least once"
      value={form.entryCheck}
      isDisabled={isLocked}
      onChange={(entryCheck) => onChange({ entryCheck })}
    />
    <GuideTextField
      id="workflow-stop-and-ask-when"
      label="Stop and ask when"
      help="When the Lead should stop and ask you."
      placeholder="It never fails, or it fails every time"
      value={form.stopRule}
      isDisabled={isLocked}
      onChange={(stopRule) => onChange({ stopRule })}
    />
    <ThenSuggestField
      workflows={workflows}
      selfId={selfId}
      value={form.thenSuggestId}
      isDisabled={isLocked}
      onChange={(thenSuggestId) => onChange({ thenSuggestId })}
    />
  </>
);
