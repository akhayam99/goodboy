import type { LeadPermissionNote } from '@goodboy/core/auto';
import { SegmentedTabs } from '@goodboy/ui';
import type { PermissionRowCopy } from './permissionRows';
import { PERMISSION_GRID_CLASS } from './permissionGrid';

type ChangeParams = {
  readonly value: string;
};

type Props = {
  readonly copy: PermissionRowCopy;
  readonly value: string;
  readonly note: LeadPermissionNote | null;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onChange: (params: ChangeParams) => void;
};

const NOTE_LINE = 'No plan is approved at this setting, so this reads as Ask first.';

export const LeadPermissionRow = ({ copy, value, note, error, isDisabled, onChange }: Props) => (
  <div data-permission-row={copy.key} className={PERMISSION_GRID_CLASS}>
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-row text-foreground">{copy.title}</span>
      <span className="text-meta text-muted-foreground">
        {note === 'askWithoutPlan' ? NOTE_LINE : copy.help}
      </span>
    </div>
    <SegmentedTabs
      size="xs"
      ariaLabel={copy.title}
      value={value}
      options={copy.options.map((option) => ({
        value: option.value,
        label: option.label,
        disabled: isDisabled,
      }))}
      onChange={(next) => onChange({ value: next })}
    />
    {error === null ? null : (
      <p role="alert" className="text-meta text-danger @md/details:col-span-2">
        {error}
      </p>
    )}
  </div>
);
