import { useMemo } from 'react';
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

const roleOptions = (): ReadonlyArray<ListboxOption<AgentRole>> =>
  visibleAgentRoles().map((role) => ({
    value: role,
    label: ROLE_LABEL[role],
    description: ROLE_REGISTRY[role].summary,
    leading: <AgentAvatar kind={kindForRole({ role })} size="xs" />,
  }));

export const RoleSelect = ({ value, onChange, disabled }: Props) => {
  const options = useMemo(roleOptions, []);
  return (
    <Listbox
      ariaLabel="Agent role"
      size="sm"
      isBlock
      searchable={false}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
};
