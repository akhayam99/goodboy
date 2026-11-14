import { ListGrid, RevealRegion, ScrollFade } from '@goodboy/ui';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalGroupSection } from './TerminalGroupSection';
import { TERMINAL_LIST_COLUMNS } from './terminalListColumns';

type Props = {
  readonly model: TerminalStudioModel;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
};

export const TerminalRail = ({ model, portsByTerminal }: Props) => {
  const selectedKey = model.worktree?.key ?? null;
  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      <RevealRegion
        header={
          <div data-grid-row="2" className="flex h-10 min-w-0 flex-col justify-center">
            <NewTerminalMenu
              clusters={model.pickerClusters}
              onNew={model.openDefault}
              onOpenAt={model.openAt}
            />
          </div>
        }
      >
        <ScrollFade viewportClassName="pb-2">
          <ListGrid label="Terminals" columns={TERMINAL_LIST_COLUMNS} isGrouped>
            {model.groups.map((group) => (
              <TerminalGroupSection
                key={group.key}
                group={group}
                selectedKey={selectedKey}
                busyIds={model.busyIds}
                exits={model.exits}
                commandOf={model.commandOf}
                portsByTerminal={portsByTerminal}
                onSelect={model.selectWorktree}
                onCloseAll={model.closeGroup}
              />
            ))}
          </ListGrid>
        </ScrollFade>
      </RevealRegion>
    </div>
  );
};
