import type { LeadPermissionKey, LeadPermissions } from '@goodboy/core/auto';
import { Eyebrow } from '@goodboy/ui';
import { LeadPermissionRow } from './LeadPermissionRow';
import { LockedRows } from './LockedRows';
import { PERMISSION_GROUPS } from './permissionGroups';
import { PERMISSION_ROWS } from './permissionRows';

type ChangeParams = {
  readonly key: LeadPermissionKey;
  readonly value: string;
};

type Props = {
  readonly permissions: LeadPermissions;
  readonly rowErrors: Readonly<Partial<Record<LeadPermissionKey, string>>>;
  readonly isDisabled: boolean;
  readonly onChange: (params: ChangeParams) => void;
};

export const LeadPermissionsPanel = ({ permissions, rowErrors, isDisabled, onChange }: Props) => (
  <div data-permissions-panel="" className="@container/details flex min-w-0 flex-col gap-6">
    {PERMISSION_GROUPS.map((group) => (
      <div key={group.title} role="group" aria-label={group.title} className="flex flex-col gap-3">
        <Eyebrow label={group.title} />
        <div className="flex flex-col gap-4">
          {PERMISSION_ROWS.filter((copy) => group.keys.includes(copy.key)).map((copy) => {
            const effective = permissions.rows[copy.key];
            return (
              <LeadPermissionRow
                key={copy.key}
                copy={copy}
                value={effective.value}
                note={effective.note}
                error={rowErrors[copy.key] ?? null}
                isDisabled={isDisabled}
                onChange={({ value }) => onChange({ key: copy.key, value })}
              />
            );
          })}
        </div>
      </div>
    ))}
    <LockedRows rows={permissions.locked} />
  </div>
);
