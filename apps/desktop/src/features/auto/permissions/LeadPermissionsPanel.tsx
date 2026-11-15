import type { AutoLevel, LeadPermissionKey, LeadPermissions } from '@goodboy/core/auto';
import { SegmentedTabs, formatUsd } from '@goodboy/ui';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';
import { LeadPermissionRow } from './LeadPermissionRow';
import { LockedRows } from './LockedRows';
import { PermissionSentence } from './PermissionSentence';
import { PERMISSION_GRID_CLASS } from './permissionGrid';
import { PERMISSION_ROWS } from './permissionRows';
import type { LeadPermissionScope } from '../hooks/useLeadPermissions';

type KeyParams = {
  readonly key: LeadPermissionKey;
};

type ChangeParams = KeyParams & {
  readonly value: string;
};

type PresetParams = {
  readonly level: AutoLevel;
};

type ScopeParams = {
  readonly scope: LeadPermissionScope;
};

type Props = {
  readonly permissions: LeadPermissions;
  readonly scope: LeadPermissionScope;
  readonly rowErrors: Readonly<Partial<Record<LeadPermissionKey, string>>>;
  readonly presetError: string | null;
  readonly isDisabled: boolean;
  readonly onChange: (params: ChangeParams) => void;
  readonly onReset: (params: KeyParams) => void;
  readonly onPreset: (params: PresetParams) => void;
  readonly onScope?: (params: ScopeParams) => void;
};

type PresetValue = AutoLevel | 'custom';

const SCOPE_OPTIONS = [
  { value: 'lead', label: 'This Lead' },
  { value: 'default', label: 'Workspace default' },
] as const;

const PRESET_OPTIONS: ReadonlyArray<{
  readonly value: PresetValue;
  readonly label: string;
  readonly tooltip?: string;
}> = [
  ...RUN_AUTONOMY_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label,
    tooltip: option.hint,
  })),
  { value: 'custom', label: 'Custom' },
];

export const LeadPermissionsPanel = ({
  permissions,
  scope,
  rowErrors,
  presetError,
  isDisabled,
  onChange,
  onReset,
  onPreset,
  onScope,
}: Props) => (
  <div data-permissions-panel={scope} className="flex min-w-0 flex-col gap-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-eyebrow text-faint-foreground">Start from</span>
        <SegmentedTabs<PresetValue>
          size="xs"
          ariaLabel="Start from"
          value={permissions.preset}
          options={PRESET_OPTIONS.map((option) => ({
            ...option,
            disabled: isDisabled || option.value === 'custom',
          }))}
          onChange={(next) => {
            if (next !== 'custom') {
              onPreset({ level: next });
            }
          }}
        />
      </div>
      {onScope === undefined ? null : (
        <SegmentedTabs<LeadPermissionScope>
          size="xs"
          ariaLabel="Applies to"
          value={scope}
          options={SCOPE_OPTIONS.map((option) => ({ ...option }))}
          onChange={(next) => onScope({ scope: next })}
        />
      )}
    </div>
    {presetError === null ? null : (
      <p role="alert" className="text-meta text-danger">
        {presetError}
      </p>
    )}
    <div className="flex flex-col gap-3">
      {PERMISSION_ROWS.map((copy) => {
        const effective = permissions.rows[copy.key];
        return (
          <LeadPermissionRow
            key={copy.key}
            copy={copy}
            value={effective.value}
            source={effective.source}
            note={effective.note}
            scope={scope}
            error={rowErrors[copy.key] ?? null}
            isDisabled={isDisabled}
            onChange={({ value }) => onChange({ key: copy.key, value })}
            onReset={() => onReset({ key: copy.key })}
          />
        );
      })}
      <div data-permission-row="spendLimit" className={PERMISSION_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-row text-foreground">Limit</span>
          <span className="text-meta text-muted-foreground">
            Counts the Lead and every agent it starts.
          </span>
        </div>
        <span className="text-meta text-foreground">
          {permissions.spendLimitUsd === null
            ? 'Set when it starts'
            : formatUsd(permissions.spendLimitUsd)}
        </span>
        <span className="text-right text-meta text-faint-foreground">pauses there, as today</span>
      </div>
    </div>
    <LockedRows rows={permissions.locked} />
    <PermissionSentence permissions={permissions} isForLead={scope === 'lead'} />
  </div>
);
