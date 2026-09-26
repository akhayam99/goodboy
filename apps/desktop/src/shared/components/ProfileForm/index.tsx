import { useCallback, useId } from 'react';
import { Eye } from 'lucide-react';
import { matchRoleLibrary } from '@goodboy/core';
import type { WorkspaceProfile } from '@goodboy/types';
import { Textarea } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import { ChipsInput } from './ChipsInput';
import { ProfileAccessPopover } from './ProfileAccessPopover';

type Props = {
  readonly value: WorkspaceProfile;
  readonly disabled?: boolean;
  readonly onChange: (profile: WorkspaceProfile) => void;
  readonly onCommit: (profile: WorkspaceProfile) => void;
};

const suggestRoles = ({
  query,
  values,
}: {
  readonly query: string;
  readonly values: ReadonlyArray<string>;
}) =>
  matchRoleLibrary({ query, exclude: values }).map((entry) => ({
    label: entry.label,
    group: entry.group,
  }));

const roleCustomLabel = ({ query }: { readonly query: string }) =>
  `Add "${query}" as your own role`;

const topicCustomLabel = ({ query }: { readonly query: string }) => `Add "${query}"`;

export const ProfileForm = ({ value, disabled = false, onChange, onCommit }: Props) => {
  const aboutWorkId = useId();
  const workingRulesId = useId();

  const changeList = useCallback(
    ({
      key,
      next,
    }: {
      readonly key: 'roles' | 'explainMore';
      readonly next: ReadonlyArray<string>;
    }) => {
      const profile = { ...value, [key]: next };
      onChange(profile);
      onCommit(profile);
    },
    [onChange, onCommit, value],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-muted-foreground">Your roles</span>
        <ChipsInput
          label="Your roles"
          values={value.roles}
          placeholder="Type a role, like Tech Lead"
          disabled={disabled}
          suggest={suggestRoles}
          customLabel={roleCustomLabel}
          onChange={(next) => changeList({ key: 'roles', next })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={aboutWorkId} className="text-label font-medium text-muted-foreground">
          About your work{' '}
          <span className="font-normal text-faint-foreground">what you do and for whom</span>
        </label>
        <Textarea
          id={aboutWorkId}
          value={value.aboutWork ?? ''}
          placeholder="Leads the payments platform team. Owns settlement correctness and the ledger schema."
          rows={3}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, aboutWork: event.target.value })}
          onBlur={() => onCommit(value)}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={workingRulesId} className="text-label font-medium text-muted-foreground">
          How agents should work with you
        </label>
        <Textarea
          id={workingRulesId}
          value={value.workingRules ?? ''}
          placeholder="Ask before touching migrations. Keep pull requests small. Tell me the tradeoff in one line."
          rows={3}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, workingRules: event.target.value })}
          onBlur={() => onCommit(value)}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-muted-foreground">
          Explain more when it touches
        </span>
        <ChipsInput
          label="Explain more when it touches"
          values={value.explainMore}
          placeholder="Add a topic, like Rust"
          disabled={disabled}
          customLabel={topicCustomLabel}
          onChange={(next) => changeList({ key: 'explainMore', next })}
        />
      </div>
      <div className="flex items-center gap-1.5 text-label text-faint-foreground">
        <Eye size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        Agents read these fields by role.
        <ProfileAccessPopover />
      </div>
    </div>
  );
};
