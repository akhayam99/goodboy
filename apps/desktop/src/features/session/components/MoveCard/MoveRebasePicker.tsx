import { useState, type ReactNode } from 'react';
import {
  AnchoredPopover,
  Button,
  Checkbox,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  useDropdown,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { nounFor } from '../../../../shared/utils/nounFor';
import type { RebasePick } from '../../../suggestions/types';

type TriggerParams = {
  readonly isOpen: boolean;
  readonly toggle: () => void;
};

type Props = {
  readonly pick: RebasePick;
  readonly trigger: (params: TriggerParams) => ReactNode;
};

type ToggleParams = {
  readonly id: string;
  readonly isChecked: boolean;
};

const FAILURE_TITLE = "Couldn't rebase the branches";
const BUSY_MESSAGE = 'Another rebase is already running in this session.';

export const MoveRebasePicker = ({ pick, trigger }: Props) => {
  const { sessionId, targets } = pick;
  const dropdown = useDropdown({
    align: 'start',
    width: POPOVER_WIDTH_CLASS.wide,
    expectedWidth: POPOVER_WIDTH_PX.wide,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const [unpicked, setUnpicked] = useState<ReadonlySet<string>>(() => new Set());
  const isRunning = useAppStore((state) => state.rebaseAllRuns[sessionId]?.phase === 'running');
  const chosen = targets.filter((target) => !unpicked.has(target.id));
  const label = `Rebase ${chosen.length} ${nounFor({ count: chosen.length, one: 'branch', many: 'branches' })}`;

  const toggleTarget = ({ id, isChecked }: ToggleParams): void => {
    setUnpicked((current) => {
      const next = new Set(current);
      if (isChecked) {
        next.delete(id);
        return next;
      }
      next.add(id);
      return next;
    });
  };

  const start = async (): Promise<void> => {
    const state = useAppStore.getState();
    close();
    try {
      const outcome = await state.rebaseAll({
        sessionId,
        mountIds: chosen.map((target) => target.mountId),
        shouldTidy: false,
      });
      if (outcome === 'busy') {
        void state.reportError({
          recovery: CHECK_STATE,
          title: FAILURE_TITLE,
          error: new Error(BUSY_MESSAGE),
          sessionId,
        });
      }
    } catch (error: unknown) {
      void state.reportError({ recovery: CHECK_STATE, title: FAILURE_TITLE, error, sessionId });
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Branches to rebase"
      hasBackdrop
      anchorClassName="flex min-w-0 items-center"
      trigger={trigger({ isOpen, toggle })}
    >
      <div data-rebase-picker="" className="flex min-w-0 flex-col gap-2 p-3">
        <ul className="flex min-w-0 flex-col">
          {targets.map((target) => (
            <li key={target.id} className="flex min-w-0 items-center">
              <Checkbox
                checked={!unpicked.has(target.id)}
                onChange={(isChecked) => toggleTarget({ id: target.id, isChecked })}
                label={
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-row text-foreground">{target.projectName}</span>
                    <span className="truncate text-meta text-muted-foreground">
                      {target.branch}, {target.behind} behind {target.baseBranch}
                    </span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={chosen.length === 0 || isRunning}
            onClick={() => void start()}
          >
            {label}
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
};
