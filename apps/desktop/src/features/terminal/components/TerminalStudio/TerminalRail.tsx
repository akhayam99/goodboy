import { ListGrid, ScrollFade } from '@goodboy/ui';
import { useTerminalPorts } from '../../../monitoring/useTerminalPorts';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalGroupSection } from './TerminalGroupSection';
import { TERMINAL_LIST_COLUMNS } from './terminalListColumns';

type Props = {
  readonly model: TerminalStudioModel;
};

export const TerminalRail = ({ model }: Props) => {
  const portsByTerminal = useTerminalPorts();
  const selectedKey = model.worktree?.key ?? null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2">
      <NewTerminalMenu
        clusters={model.pickerClusters}
        onNew={model.openDefault}
        onOpenAt={model.openAt}
      />
      <ScrollFade viewportClassName="pb-2">
        <ListGrid label="Terminals" columns={TERMINAL_LIST_COLUMNS} isGrouped>
          {model.groups.map((group) => (
            <TerminalGroupSection
              key={group.key}
              group={group}
              selectedKey={selectedKey}
              busyIds={model.busyIds}
              portsByTerminal={portsByTerminal}
              onSelect={model.selectWorktree}
              onCloseAll={model.closeGroup}
            />
          ))}
        </ListGrid>
      </ScrollFade>
    </div>
  );
};
