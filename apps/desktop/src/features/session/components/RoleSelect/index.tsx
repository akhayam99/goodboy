import { ROLE_REGISTRY } from '@goodboy/core';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { AgentRole } from '@goodboy/types';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { kindForRole, ROLE_LABEL, visibleAgentRoles } from '../../agent-kind';

type Props = {
  value: AgentRole;
  onChange: (role: AgentRole) => void;
  disabled: boolean;
};

const ROLE_OPTIONS: ReadonlyArray<ListboxOption<AgentRole>> = visibleAgentRoles().map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
  description: ROLE_REGISTRY[role].summary,
  leading: <AgentAvatar kind={kindForRole({ role })} size="xs" />,
}));

export const RoleSelect = ({ value, onChange, disabled }: Props) => (
  <Listbox
    ariaLabel="Agent role"
    size="sm"
    isBlock
    searchable={false}
    value={value}
    options={ROLE_OPTIONS}
    onChange={onChange}
    disabled={disabled}
  />
);
