import { useEffect, useMemo, useRef } from 'react';
import { Button, SelectionBar, SelectionConfirm, type SelectionVerb } from '@goodboy/ui';
import type { SelectionBarPlacement } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import { shortcutGlyphs } from '../../keyboard/registry';
import type { ActionControls } from '../../../features/actions/useActionControls';

type Props = {
  readonly controls: ActionControls;
  readonly verbIds: ReadonlyArray<string>;
  readonly count: number;
  readonly total: number;
  readonly onClear: () => void;
  readonly onSelectAll: () => void;
  readonly onDone?: () => void;
  readonly onFocusReturn?: () => void;
  readonly placement?: SelectionBarPlacement;
  readonly className?: string;
};

export const ObjectSelectionBar = ({
  controls,
  verbIds,
  count,
  total,
  onClear,
  onSelectAll,
  onDone,
  onFocusReturn,
  placement,
  className,
}: Props) => {
  const { actions, pendingId, confirming, failure } = controls;
  const wasPending = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const hasFailed = failure !== null;

  useEffect(() => {
    const isPending = pendingId !== null;
    if (wasPending.current && !isPending && !hasFailed) {
      doneRef.current?.();
    }
    wasPending.current = isPending;
  }, [hasFailed, pendingId]);

  const verbs = useMemo(
    () =>
      verbIds.flatMap((id): ReadonlyArray<SelectionVerb> => {
        const action = actions.find((candidate) => candidate.id === id);
        if (action === undefined) {
          return [];
        }
        const Icon = action.icon;
        return [
          {
            id: action.id,
            label: action.shortLabel,
            ariaLabel: action.label,
            title: action.blockedReason ?? action.label,
            icon: <Icon size={ICON_SIZE.row} aria-hidden />,
            tone: action.confirm?.role === 'danger' ? 'danger' : 'neutral',
            isBusy: pendingId === action.id,
            isDisabled: action.blockedReason !== null || (pendingId !== null && pendingId !== id),
            onRun: () => controls.trigger({ actionId: action.id }),
          },
        ];
      }),
    [actions, controls, pendingId, verbIds],
  );

  const confirmAction = confirming?.confirm ?? null;
  const alt =
    confirmAction?.altActionId === undefined
      ? undefined
      : actions.find((candidate) => candidate.id === confirmAction.altActionId);
  const Icon = confirming?.icon;

  const confirmNode =
    confirming === null || confirmAction === null || Icon === undefined ? null : (
      <SelectionConfirm
        role={confirmAction.role}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        title={confirmAction.title}
        {...(confirmAction.goes === undefined && { description: confirmAction.description })}
        {...(confirmAction.goes !== undefined && { goes: confirmAction.goes })}
        {...(confirmAction.stays !== undefined && { stays: confirmAction.stays })}
        {...(confirmAction.items !== undefined && { items: confirmAction.items })}
        confirmLabel={confirmAction.confirmLabel}
        isBusy={pendingId === confirming.id}
        onConfirm={controls.confirm}
        onCancel={controls.cancel}
        {...(alt !== undefined && {
          altAction: {
            label: `${alt.shortLabel} instead`,
            onClick: () => {
              controls.cancel();
              controls.trigger({ actionId: alt.id });
            },
          },
        })}
      />
    );

  const note =
    failure === null || count === 0 ? null : (
      <div
        role="alert"
        className="flex max-w-sm items-center gap-2 rounded-lg border border-danger bg-floating px-3 py-2 text-meta text-danger shadow-lg"
      >
        <span className="min-w-0 flex-1">{failure.message}</span>
        <Button variant="ghost" size="sm" onClick={controls.retry}>
          Retry
        </Button>
      </div>
    );

  return (
    <SelectionBar
      count={count}
      total={total}
      verbs={verbs}
      onClear={onClear}
      onSelectAll={onSelectAll}
      confirm={confirmNode}
      onDismissConfirm={controls.cancel}
      note={note}
      clearHint={shortcutGlyphs('selection.clear')}
      selectAllHint={shortcutGlyphs('selection.all')}
      onFocusReturn={onFocusReturn}
      placement={placement}
      className={className}
    />
  );
};
