import { useMemo } from 'react';
import { Listbox } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { START_PICK_TRIGGER } from '../SessionKickoff/startPickTrigger';
import { startRunBranchOptionsOf } from '../../startRun/startRunBranchOptionsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly branch: string | null;
  readonly isDisabled: boolean;
  readonly onChange: (branch: string | null) => void;
};

const LABEL = 'Branch';

export const StartRunBranchChip = ({ sessionId, branch, isDisabled, onChange }: Props) => {
  const mounts = useAppStore((state) => state.sessionMounts[sessionId] ?? EMPTY_ARRAY);
  const choice = useMemo(
    () =>
      startRunBranchOptionsOf({
        branches: mounts.filter((mount) => mount.isAttached).map((mount) => mount.branch),
        picked: branch,
      }),
    [branch, mounts],
  );
  if (choice === null) {
    return null;
  }
  return (
    <Listbox<string>
      ariaLabel={LABEL}
      size="sm"
      options={choice.options}
      value={choice.value}
      disabled={isDisabled || choice.options.length < 2}
      onChange={(next) => onChange(next === choice.anyValue ? null : next)}
      className={START_PICK_TRIGGER}
      valueLabel={
        <>
          <span className="shrink-0 text-faint-foreground">{LABEL}:</span>
          <span className="min-w-0 truncate text-foreground">{choice.label}</span>
        </>
      }
    />
  );
};
