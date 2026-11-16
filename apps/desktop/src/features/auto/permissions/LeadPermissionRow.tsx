import type { LeadPermissionNote, LeadPermissionSource } from '@goodboy/core/auto';
import { Button, Chip, SegmentedTabs } from '@goodboy/ui';
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

const changedHintOf = ({ scope }: Pick<SourceParams, 'scope'>): string =>
  scope === 'lead' ? 'Differs from the workspace default' : 'Differs from the level default';

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
}: Props) => {
  const isChanged = isOwn({ source, scope });
  return (
    <div
      data-permission-row={copy.key}
      data-changed={isChanged ? 'true' : undefined}
      className={PERMISSION_GRID_CLASS}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-2">
          <span className="text-row text-foreground">{copy.title}</span>
          {isChanged ? (
            <>
              <Chip tone="info" label="Changed" title={changedHintOf({ scope })} />
              <Button
                variant="quiet"
                size="xs"
                intent="neutral"
                disabled={isDisabled}
                aria-label={`Reset ${copy.title}`}
                onClick={onReset}
              >
                Reset
              </Button>
            </>
          ) : null}
        </span>
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
        <p role="alert" className="col-span-2 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
