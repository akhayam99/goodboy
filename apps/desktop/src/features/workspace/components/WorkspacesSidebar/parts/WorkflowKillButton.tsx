import { Ban } from 'lucide-react';
import { ConfirmableButton } from '../../../../../shared/components/ConfirmableButton';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowKillButton = ({ onConfirm }: Props) => {
  return (
    <ConfirmableButton
      label="Discard"
      armedLabel="Confirm discard"
      onConfirm={onConfirm}
      tone="danger"
      title="discard workflow"
      ariaLabel="discard workflow"
      icon={<Ban size={9} aria-hidden />}
    />
  );
};
