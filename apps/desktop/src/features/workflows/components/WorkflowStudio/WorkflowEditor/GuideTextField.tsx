import { PromptField } from '../../../../../shared/components/PromptField';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly help: string;
  readonly placeholder: string;
  readonly value: string;
  readonly isDisabled: boolean;
  readonly onChange: (value: string) => void;
};

export const GuideTextField = ({
  id,
  label,
  help,
  placeholder,
  value,
  isDisabled,
  onChange,
}: Props) => (
  <WorkflowSection label={label} help={help}>
    <PromptField
      kind="document"
      label={label}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={isDisabled}
      minRows={2}
      maxRows={6}
    />
  </WorkflowSection>
);
