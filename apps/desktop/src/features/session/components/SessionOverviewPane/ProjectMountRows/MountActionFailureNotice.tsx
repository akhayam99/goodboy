import { Button, Notice } from '@goodboy/ui';
import type { ActionControls } from '../../../../actions/useActionControls';
import { mountActionFailureOf } from './mountActionFailure';

type Props = {
  readonly projectName: string;
  readonly controls: ActionControls;
};

export const MountActionFailureNotice = ({ projectName, controls }: Props) => {
  const failure = controls.failure;
  if (failure === null) {
    return null;
  }
  const action = controls.actions.find((candidate) => candidate.id === failure.actionId);
  const view = mountActionFailureOf({
    actionId: failure.actionId,
    actionLabel: action?.label ?? 'finish that action',
    projectName,
  });
  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={view.title}
      body={view.body}
      detail={failure.message}
      actions={
        <Button variant="secondary" size="sm" onClick={controls.retry}>
          Retry
        </Button>
      }
    />
  );
};
