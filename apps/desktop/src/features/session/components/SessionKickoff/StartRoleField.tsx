import { useMemo } from 'react';
import { cn, Listbox, type ListboxOption } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  AGENT_KIND_META,
  agentKindPalette,
  visibleAgentKinds,
  type AgentKind,
} from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from './startPickTrigger';

type Props = {
  readonly value: AgentKind;
  readonly isDisabled: boolean;
  readonly onChange: (kind: AgentKind) => void;
};

const roleOptions = (): ReadonlyArray<ListboxOption<AgentKind>> =>
  visibleAgentKinds()
    .filter((kind) => kind !== 'auto')
    .map((kind) => {
      const palette = agentKindPalette({ kind });
      const Icon = palette.icon;
      return {
        value: kind,
        label: AGENT_KIND_META[kind].noun,
        description: AGENT_KIND_META[kind].hint,
        leading: <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', palette.fg)} />,
      };
    });

export const StartRoleField = ({ value, isDisabled, onChange }: Props) => {
  const options = useMemo(roleOptions, []);
  return (
    <Listbox
      ariaLabel={START_KIND_COPY.role}
      size="sm"
      value={value}
      options={options}
      onChange={onChange}
      disabled={isDisabled}
      searchable={false}
      className={START_PICK_TRIGGER}
      valueLabel={
        <>
          <span className="shrink-0 text-faint-foreground">{START_KIND_COPY.role}</span>
          <span className="min-w-0 truncate text-foreground">{AGENT_KIND_META[value].noun}</span>
        </>
      }
    />
  );
};
