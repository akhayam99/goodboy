import type { AutoLevel, LeadPermissionKey, LeadPermissions } from '@goodboy/core/auto';
import { Eyebrow, SegmentedTabs } from '@goodboy/ui';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';
import { LeadPermissionRow } from './LeadPermissionRow';
import { LockedRows } from './LockedRows';
import { PermissionLimitRow } from './PermissionLimitRow';
import { PermissionSentence } from './PermissionSentence';
import { PERMISSION_GROUPS } from './permissionGroups';
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

const SUBTITLE = {
  lead: 'What this Lead does alone, and where it stops for you.',
  default: 'What a new Lead in this workspace does alone.',
} as const satisfies Record<LeadPermissionScope, string>;

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
  <div data-permissions-panel={scope} className="flex min-w-0 flex-col gap-6 p-5">
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-heading text-foreground">Asks you</span>
        <span className="text-meta text-faint-foreground">{SUBTITLE[scope]}</span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
        {onScope === undefined ? null : (
          <>
            <span className="text-eyebrow text-muted-foreground">Applies to</span>
            <SegmentedTabs<LeadPermissionScope>
              size="xs"
              ariaLabel="Applies to"
              value={scope}
              options={SCOPE_OPTIONS.map((option) => ({ ...option }))}
              onChange={(next) => onScope({ scope: next })}
            />
          </>
        )}
        <span className="text-eyebrow text-muted-foreground">Start from</span>
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
      {presetError === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {presetError}
        </p>
      )}
      <PermissionSentence permissions={permissions} isForLead={scope === 'lead'} />
    </div>
    {PERMISSION_GROUPS.map((group) => (
      <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
        <Eyebrow label={group.title} />
        <div className="flex flex-col gap-4">
          {PERMISSION_ROWS.filter((copy) => group.keys.includes(copy.key)).map((copy) => {
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
          {group.hasLimit ? <PermissionLimitRow spendLimitUsd={permissions.spendLimitUsd} /> : null}
        </div>
      </section>
    ))}
    <LockedRows rows={permissions.locked} />
  </div>
);
