import { CircleCheck } from 'lucide-react';
import { ConfirmPopover, GhostActionButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { CLOSE_WORKFLOW_COPY } from '../../closeWorkflowCopy';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowCloseButton = ({ onConfirm }: Props) => (
  <ConfirmPopover
    role="alert"
    icon={<CircleCheck size={ICON_SIZE.row} aria-hidden />}
    title={CLOSE_WORKFLOW_COPY.title}
    description={CLOSE_WORKFLOW_COPY.description}
    confirmLabel={CLOSE_WORKFLOW_COPY.label}
    onConfirm={onConfirm}
    trigger={({ arm }) => (
      <GhostActionButton
        icon={CircleCheck}
        label={CLOSE_WORKFLOW_COPY.label}
        title={CLOSE_WORKFLOW_COPY.hint}
        onClick={arm}
      />
    )}
  />
);
