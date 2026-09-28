import { useMemo, useState } from 'react';
import { Button, KbdPill, Tooltip, cn, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ResolvedAction } from '../../../actions/types';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { DraftModelPicker } from './DraftModelPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly modelPickerRequest: number;
  readonly hiddenActionIds?: ReadonlyArray<string>;
};

const NONE: ReadonlyArray<string> = [];

const buttonsOf = (
  actions: ReadonlyArray<ResolvedAction>,
  hidden: ReadonlyArray<string>,
): ReadonlyArray<ResolvedAction> => {
  const shown = actions.filter((action) => !hidden.includes(action.id));
  return [
    ...shown.filter((action) => action.slot === 'secondary'),
    ...shown.filter((action) => action.slot === 'primary'),
  ];
};

export const ReviewHeaderActions = ({
  sessionId,
  modelPickerRequest,
  hiddenActionIds = NONE,
}: Props) => {
  const target = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttons = buttonsOf(actions, hiddenActionIds);

  const press = async (actionId: string): Promise<void> => {
    if (pendingId !== null) {
      return;
    }
    setPendingId(actionId);
    setError(null);
    try {
      await run({ actionId });
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {buttons.map((action) => {
          const button = (
            <Button
              key={action.id}
              size="sm"
              variant={action.slot === 'primary' ? 'primary' : 'secondary'}
              data-review-action={action.id}
              disabled={action.blockedReason !== null}
              isBusy={pendingId === action.id}
              onClick={() => void press(action.id)}
            >
              <action.icon size={ICON_SIZE.control} aria-hidden />
              {action.label}
              {action.shortcut !== null && (
                <KbdPill
                  aria-hidden
                  className={cn(
                    'ml-1 h-4 min-w-4 text-meta',
                    action.slot === 'primary' && 'border-on-tone/30 bg-on-tone/15 text-on-tone',
                  )}
                >
                  {shortcutGlyphs(action.shortcut)}
                </KbdPill>
              )}
            </Button>
          );
          return action.blockedReason === null ? (
            button
          ) : (
            <Tooltip key={action.id} content={action.blockedReason} anchorClassName="inline-flex">
              {button}
            </Tooltip>
          );
        })}
        <DraftModelPicker sessionId={sessionId} request={modelPickerRequest}>
          <ObjectOverflowMenu target={target} label={REVIEW_FLOW_LABEL.reviewActions} />
        </DraftModelPicker>
      </div>
      {error !== null && (
        <p role="alert" className="max-w-[40ch] text-right text-secondary text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
