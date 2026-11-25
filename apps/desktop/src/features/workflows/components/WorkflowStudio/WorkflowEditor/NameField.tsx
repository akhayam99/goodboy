import { FieldError, Input } from '@goodboy/ui';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly value: string;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onChange: (value: string) => void;
};

const NAME_ID = 'workflow-name';
const NAME_ERROR_ID = 'workflow-name-error';

export const NameField = ({ value, error, isDisabled, onChange }: Props) => (
  <WorkflowSection label="Name" htmlFor={NAME_ID}>
    <Input
      id={NAME_ID}
      aria-label="Workflow name"
      size="md"
      value={value}
      placeholder="Fix a flaky test"
      disabled={isDisabled}
      aria-invalid={error === null ? undefined : true}
      aria-describedby={error === null ? undefined : NAME_ERROR_ID}
      onChange={(event) => onChange(event.target.value)}
    />
    <FieldError id={NAME_ERROR_ID} error={error} />
  </WorkflowSection>
);
