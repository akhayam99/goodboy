import { useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import { useTerminalPorts } from '../../../monitoring/useTerminalPorts';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalGroupSection } from './TerminalGroupSection';
import { TerminalRow } from './TerminalRow';

type Props = {
  readonly model: TerminalStudioModel;
};

const NO_PORTS: ReadonlyArray<number> = [];

export const TerminalRail = ({ model }: Props) => {
  const portsByTerminal = useTerminalPorts();
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});
  const selectedKey =
    model.groups.find((group) => group.tabs.some((tab) => tab.id === model.selected?.id))?.key ??
    null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
      <NewTerminalMenu
        targets={model.menuTargets}
        onNew={model.openDefault}
        onOpenAt={model.openAt}
      />
      <ScrollFade viewportClassName="flex flex-col gap-2 pb-2">
        {model.groups.map((group) => {
          const isOpen =
            toggled[group.key] ?? (group.kind === 'workspace' || group.key === selectedKey);
          return (
            <TerminalGroupSection
              key={group.key}
              group={group}
              isOpen={isOpen}
              onToggle={() => setToggled((current) => ({ ...current, [group.key]: !isOpen }))}
            >
              {group.tabs.map((tab) => (
                <TerminalRow
                  key={tab.id}
                  tab={tab}
                  isSelected={tab.id === model.selected?.id}
                  isBusy={model.busyIds.has(tab.id)}
                  command={model.commandOf(tab)}
                  ports={portsByTerminal.get(tab.id) ?? NO_PORTS}
                  onSelect={() => model.select(tab)}
                  onClose={() => model.closeTab(tab)}
                  onRestart={() => model.restartTab(tab)}
                  onRename={(title) => model.renameTab({ tab, title })}
                />
              ))}
            </TerminalGroupSection>
          );
        })}
      </ScrollFade>
    </div>
  );
};
