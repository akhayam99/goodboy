import { useState } from 'react';
import { Button, Checkbox } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { RebaseSuggestionTarget } from './types';
import { rebasePickLabelOf } from './rebasePickLabelOf';

type Props = {
  readonly sessionId: SessionId;
  readonly targets: ReadonlyArray<RebaseSuggestionTarget>;
  readonly onClose: () => void;
};

type ToggleParams = {
  readonly id: string;
  readonly isChecked: boolean;
};

const TIDY_LABEL = 'Also tidy commits with Auto';
const FAILURE_TITLE = "Couldn't rebase the branches";

export const NextStepRebasePicker = ({ sessionId, targets, onClose }: Props) => {
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(targets.map((target) => target.id)),
  );
  const [shouldTidy, setShouldTidy] = useState(false);
  const isRunning = useAppStore((s) => s.rebaseAllRuns[sessionId]?.phase === 'running');
  const chosen = targets.filter((target) => picked.has(target.id));
  const label = rebasePickLabelOf({ picked: chosen.length, total: targets.length });
  const toggle = ({ id, isChecked }: ToggleParams): void => {
    setPicked((current) => {
      const next = new Set(current);
      if (isChecked) {
        next.add(id);
        return next;
      }
      next.delete(id);
      return next;
    });
  };
  const start = (): void => {
    const state = useAppStore.getState();
    void state
      .rebaseAll({
        sessionId,
        mountIds: chosen.map((target) => target.mountId),
        shouldTidy,
      })
      .catch((error: unknown) => state.reportError({ title: FAILURE_TITLE, error, sessionId }));
    onClose();
  };
  return (
    <div
      role="group"
      aria-label="Branches to rebase"
      data-rebase-picker=""
      className="flex min-w-0 flex-col gap-2 rounded-md bg-subtle p-3"
    >
      <ul className="flex min-w-0 flex-col">
        {targets.map((target) => (
          <li key={target.id} className="flex min-w-0 items-center gap-2">
            <Checkbox
              checked={picked.has(target.id)}
              onChange={(isChecked) => toggle({ id: target.id, isChecked })}
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
      <Checkbox checked={shouldTidy} onChange={setShouldTidy} label={TIDY_LABEL} />
      <div className="flex min-w-0 items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={chosen.length === 0 || isRunning}
          onClick={start}
        >
          {label}
        </Button>
      </div>
    </div>
  );
};
