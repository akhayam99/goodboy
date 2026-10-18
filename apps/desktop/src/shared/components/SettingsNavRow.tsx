import { SelectableRow, StatusDot, cn, type Tone } from '@goodboy/ui';

type SettingsNavStatus = {
  readonly tone: Tone;
  readonly label: string | null;
};

type Props = {
  readonly label: string;
  readonly isCurrent?: boolean;
  readonly status?: SettingsNavStatus | null;
  readonly onClick: () => void;
};

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors';

export const SettingsNavRow = ({ label, isCurrent = false, status = null, onClick }: Props) => (
  <SelectableRow
    selected={isCurrent}
    ariaCurrent={isCurrent}
    onClick={onClick}
    className={cn('h-7 items-center gap-2 px-2 text-ui', FOCUS)}
  >
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {status === null ? null : (
      <StatusDot
        tone={status.tone}
        size="sm"
        {...(status.label !== null && { ariaLabel: status.label })}
      />
    )}
  </SelectableRow>
);
