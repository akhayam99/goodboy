import type { LeadPermissionNote, LeadPermissionSource } from '@goodboy/core/auto';
import { Button, SegmentedTabs } from '@goodboy/ui';
import type { PermissionRowCopy } from './permissionRows';
import { PERMISSION_GRID_CLASS } from './permissionGrid';
import type { LeadPermissionScope } from '../hooks/useLeadPermissions';

type ChangeParams = {
  readonly value: string;
};

type Props = {
  readonly copy: PermissionRowCopy;
  readonly value: string;
  readonly source: LeadPermissionSource;
  readonly note: LeadPermissionNote | null;
  readonly scope: LeadPermissionScope;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onChange: (params: ChangeParams) => void;
  readonly onReset: () => void;
};

const NOTE_LINE = 'No plan is approved at this setting, so this reads as Ask.';

type SourceParams = {
  readonly source: LeadPermissionSource;
  readonly scope: LeadPermissionScope;
};

const isOwn = ({ source, scope }: SourceParams): boolean =>
  scope === 'lead' ? source === 'lead' : source === 'default';

const quietWordOf = ({ scope }: Pick<SourceParams, 'scope'>): string =>
  scope === 'lead' ? 'Workspace default' : 'Level default';

export const LeadPermissionRow = ({
  copy,
  value,
  source,
  note,
  scope,
  error,
  isDisabled,
  onChange,
  onReset,
}: Props) => (
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
    {isOwn({ source, scope }) ? (
      <span className="flex items-baseline justify-end gap-2 text-meta">
        <span className="text-primary">{scope === 'lead' ? 'This Lead' : 'Set here'}</span>
        <Button variant="quiet" size="xs" disabled={isDisabled} onClick={onReset}>
          Reset
        </Button>
      </span>
    ) : (
      <span className="text-right text-meta text-faint-foreground">{quietWordOf({ scope })}</span>
    )}
    {error === null ? null : (
      <p role="alert" className="col-span-3 text-meta text-danger">
        {error}
      </p>
    )}
  </div>
);
