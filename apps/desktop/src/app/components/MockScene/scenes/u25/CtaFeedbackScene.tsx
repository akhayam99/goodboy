import { ArrowUp } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';

import { actionButtonStateOf } from '../../../../../features/actions/actionButtonStateOf';
import { ActionStatusLine } from '../../../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ActionControls } from '../../../../../features/actions/useActionControls';

type Variant = 'pending' | 'done' | 'failed';

type Props = {
  readonly variant: Variant;
};

const PUSH_ID = 'diff.push';

type ControlsParams = {
  readonly variant: Variant;
};

const controlsOf = ({ variant }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: variant === 'pending' ? PUSH_ID : null,
  confirming: null,
  failure:
    variant === 'failed'
      ? {
          actionId: PUSH_ID,
          message: 'pre-push hook declined: seenEvents is assigned but never used',
          error: new Error('pre-push hook declined'),
          choice: null,
        }
      : null,
  outcome: variant === 'done' ? { actionId: PUSH_ID, message: 'Pushed 1 commit to origin.' } : null,
  trigger: () => undefined,
  confirm: async () => undefined,
  cancel: () => undefined,
  retry: () => undefined,
  dismissFailure: () => undefined,
  dismissOutcome: () => undefined,
});

export const CtaFeedbackScene = ({ variant }: Props) => {
  const controls = controlsOf({ variant });
  const state = actionButtonStateOf({
    controls,
    actionId: PUSH_ID,
    label: 'Push 1 commit',
    pendingLabel: 'Pushing…',
  });
  return (
    <div className="flex w-[720px] flex-col gap-2 bg-background p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-foreground">hl/fix-duplicate-credit</p>
        <Button size="sm" variant="secondary" isBusy={state.isBusy} busyLabel={state.label}>
          <ArrowUp size={ICON_SIZE.control} aria-hidden />
          {state.label}
        </Button>
      </div>
      <ActionStatusLine controls={controls} showReasons={false} />
    </div>
  );
};
