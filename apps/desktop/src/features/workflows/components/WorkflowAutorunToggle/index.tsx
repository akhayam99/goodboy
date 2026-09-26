import { Switch } from '@goodboy/ui';

type Props = {
  readonly isOn: boolean;
  readonly onToggle: () => void;
};

export const WorkflowAutorunToggle = ({ isOn, onToggle }: Props) => (
  <span data-testid="workflow-autorun-toggle" className="inline-flex shrink-0 items-center">
    <Switch
      label="Autorun"
      checked={isOn}
      onChange={() => onToggle()}
      className="min-h-7 text-secondary font-medium"
    />
  </span>
);
