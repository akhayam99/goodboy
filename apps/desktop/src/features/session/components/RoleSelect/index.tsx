import { useMemo } from 'react';
import { ROLE_REGISTRY } from '@goodboy/core';
import { cn, Listbox, type ListboxOption } from '@goodboy/ui';
import type { AgentRole } from '@goodboy/types';
import { agentKindPalette, kindForRole, ROLE_LABEL, visibleAgentRoles } from '../../agent-kind';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  value: AgentRole;
  onChange: (role: AgentRole) => void;
  disabled: boolean;
};

const roleOptions = (): ReadonlyArray<ListboxOption<AgentRole>> =>
  visibleAgentRoles().map((role) => {
    const palette = agentKindPalette({ kind: kindForRole({ role }) });
    const Icon = palette.icon;
    return {
      value: role,
      label: ROLE_LABEL[role],
      description: ROLE_REGISTRY[role].summary,
      leading: <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', palette.fg)} />,
    };
  });

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
