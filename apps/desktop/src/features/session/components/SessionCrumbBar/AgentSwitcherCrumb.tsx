import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AgentId } from '@goodboy/types';
import { SIBLING_GROUP_LABEL_CLASS } from './crumbClasses';
import { SiblingRow } from './SiblingRow';
import { SwitcherCrumb } from './SwitcherCrumb';
import type { SwitcherEntry } from './switcherEntry';

type AgentSwitcherCrumbProps = {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly accessory?: ReactNode;
  readonly siblings: ReadonlyArray<SwitcherEntry>;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
  readonly onNavigate?: () => void;
};

export const AgentSwitcherCrumb = ({
  label,
  icon,
  accessory,
  siblings,
  selectedAgentId,
  onSelect,
  onNavigate,
}: AgentSwitcherCrumbProps) => {
  const active = siblings.filter((entry) => !entry.isFinished);
  const done = siblings.filter((entry) => entry.isFinished);
  const showGroups = active.length > 0 && done.length > 0;

  return (
    <SwitcherCrumb
      label={label}
      menuLabel="Switch agent"
      icon={icon}
      accessory={accessory}
      onNavigate={onNavigate}
    >
      {({ close }) => (
        <>
          {active.length > 0 && (
            <>
              {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Active</span>}
              {active.map((entry) => (
                <SiblingRow
                  key={entry.agent.id}
                  entry={entry}
                  selectedAgentId={selectedAgentId}
                  onSelect={(id) => {
                    close();
                    onSelect(id);
                  }}
                />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              {showGroups && <span className={SIBLING_GROUP_LABEL_CLASS}>Done</span>}
              {done.map((entry) => (
                <SiblingRow
                  key={entry.agent.id}
                  entry={entry}
                  selectedAgentId={selectedAgentId}
                  onSelect={(id) => {
                    close();
                    onSelect(id);
                  }}
                />
              ))}
            </>
          )}
        </>
      )}
    </SwitcherCrumb>
  );
};
