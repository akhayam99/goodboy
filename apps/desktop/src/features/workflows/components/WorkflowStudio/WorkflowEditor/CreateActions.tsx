import { Button, FormActions } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../../actions/actionButtonLookOf';
import { NAMES } from '../../../../../shared/utils/names';

type Props = {
  readonly reason: string | null;
  readonly error: string | null;
  readonly isCreating: boolean;
  readonly isDisabled: boolean;
  readonly onDiscard: () => void;
  readonly onCreate: () => void;
};

const REASON_ID = 'workflow-create-reason';

export const CreateActions = ({
  reason,
  error,
  isCreating,
  isDisabled,
  onDiscard,
  onCreate,
}: Props) => (
  <FormActions reason={reason} reasonId={REASON_ID}>
    <Button
      {...actionButtonLookOf({ verb: 'discard draft', variant: 'ghost' })}
      size="sm"
      disabled={isCreating}
      onClick={onDiscard}
    >
      Discard
    </Button>
    <Button
      size="sm"
      disabled={isDisabled}
      isBusy={isCreating}
      busyLabel="Creating workflow"
      {...(reason === null ? {} : { 'aria-describedby': REASON_ID })}
      onClick={onCreate}
    >
      {error === null ? 'Create workflow' : NAMES.retry}
    </Button>
  </FormActions>
);
