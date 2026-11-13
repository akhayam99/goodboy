import { useEffect } from 'react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { actionButtonStateOf } from '../../../../../../features/actions/actionButtonStateOf';
import { ActionStatusLine } from '../../../../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ActionControls } from '../../../../../../features/actions/useActionControls';

type Variant = 'idle' | 'busy' | 'done' | 'failed';

type Theme = 'dark' | 'light';

type Props = {
  readonly variant: Variant;
  readonly theme: Theme;
};

const MERGE_ID = 'pullRequest.merge';

type ControlsParams = {
  readonly variant: Variant;
};

const controlsOf = ({ variant }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: variant === 'busy' ? MERGE_ID : null,
  pendingSeconds: variant === 'busy' ? 7 : null,
  confirming: null,
  failure:
    variant === 'failed'
      ? {
          actionId: MERGE_ID,
          message: 'Base branch was modified. Review the new commits on main, then merge again.',
          error: new Error('Base branch was modified'),
          choice: 'squash',
        }
      : null,
  outcome: variant === 'done' ? { actionId: MERGE_ID, message: 'Merged #318 into main.' } : null,
  trigger: () => undefined,
  confirm: async () => undefined,
  cancel: () => undefined,
  retry: () => undefined,
  dismissFailure: () => undefined,
  dismissOutcome: () => undefined,
});

const MergeIcon = CONCEPT_ICONS.merge;

export const ActionRunLineScene = ({ variant, theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  const controls = controlsOf({ variant });
  const state = actionButtonStateOf({
    controls,
    actionId: MERGE_ID,
    label: 'Merge',
    pendingLabel: 'Merging…',
  });
  return (
    <div className="flex w-[720px] flex-col gap-2 bg-background p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body text-foreground">Ledger export for payments-api</p>
          <p className="text-meta text-muted-foreground">
            #318 · harborline/ledger-export into main
          </p>
        </div>
        <Button size="sm" variant="primary" isBusy={state.isBusy} busyLabel={state.label}>
          <MergeIcon size={ICON_SIZE.control} aria-hidden />
          {state.label}
        </Button>
      </div>
      <ActionStatusLine controls={controls} showReasons={false} />
    </div>
  );
};
