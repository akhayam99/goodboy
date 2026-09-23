import { Ban } from 'lucide-react';
import { ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowKillButton = ({ onConfirm }: Props) => (
  <ConfirmPopover
    role="alert"
    icon={<Ban size={ICON_SIZE.row} aria-hidden />}
    title="Discard workflow?"
    description="Moves the run to Discarded, where you can restore it. Agents already spawned stay in the session."
    confirmLabel="Discard"
    onConfirm={onConfirm}
    trigger={({ isArmed, arm }) => (
      <button
        type="button"
        onClick={arm}
        aria-label="Discard workflow"
        aria-expanded={isArmed}
        className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground"
      >
        <Ban size={ICON_SIZE.control} aria-hidden />
        Discard
      </button>
    )}
  />
);
