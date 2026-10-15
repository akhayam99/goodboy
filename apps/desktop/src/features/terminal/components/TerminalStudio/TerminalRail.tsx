import { ScrollFade } from '@goodboy/ui';
import { useTerminalPorts } from '../../../monitoring/useTerminalPorts';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalGroupSection } from './TerminalGroupSection';

type Props = {
  readonly model: TerminalStudioModel;
};

export const TerminalRail = ({ model }: Props) => {
  const portsByTerminal = useTerminalPorts();
  const selectedKey = model.worktree?.key ?? null;
  const all = model.groups.flatMap((group) => group.worktrees);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
      <NewTerminalMenu
        clusters={model.pickerClusters}
        onNew={model.openDefault}
        onOpenAt={model.openAt}
      />
      <ScrollFade viewportClassName="flex flex-col gap-3 pb-2">
        {model.groups.map((group) => (
          <TerminalGroupSection
            key={group.key}
            group={group}
            selectedKey={selectedKey}
            busyIds={model.busyIds}
            portsByTerminal={portsByTerminal}
            onSelect={(key) => {
              const target = all.find((candidate) => candidate.key === key);
              if (target !== undefined) {
                model.selectWorktree(target);
              }
            }}
          />
        ))}
      </ScrollFade>
    </div>
  );
};
