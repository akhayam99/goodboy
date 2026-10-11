import { useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { TerminalGroupSection } from './TerminalGroupSection';
import { TerminalRow } from './TerminalRow';

type Props = {
  readonly model: TerminalStudioModel;
};

export const TerminalRail = ({ model }: Props) => {
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});
  const selectedKey =
    model.groups.find((group) => group.tabs.some((tab) => tab.id === model.selected?.id))?.key ??
    null;

  return (
    <ScrollFade viewportClassName="flex flex-col gap-2 px-2 py-2">
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
  );
};
