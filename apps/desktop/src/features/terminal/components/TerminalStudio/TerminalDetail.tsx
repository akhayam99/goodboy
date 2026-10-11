import { EmptyState, Button } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { displayCwd } from '../../terminalTargets';
import { LocationRow } from './LocationRow';
import { TerminalPane } from './TerminalPane';

type Props = {
  readonly model: TerminalStudioModel;
  readonly isActive: boolean;
  readonly onDock: (() => void) | undefined;
};

export const TerminalDetail = ({ model, isActive, onDock }: Props) => {
  const { selected } = model;
  if (selected === null) {
    return (
      <EmptyState
        size="page"
        tone={CONCEPT_TONE.terminal}
        icon={CONCEPT_ICONS.terminal}
        title="No terminal yet"
        description="Open a terminal in your workspace folder."
        action={
          <Button size="sm" variant="secondary" onClick={model.openDefault}>
            New terminal
          </Button>
        }
      />
    );
  }
  const isIdle = selected.status !== 'exited' && !model.busyIds.has(selected.id);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <LocationRow
        cwd={displayCwd({ cwd: selected.cwd, folder: model.folder, home: model.home })}
        targets={model.targets}
        isIdle={isIdle}
        onDock={onDock}
        onOpenAt={model.openAt}
        onChangeDirectory={model.changeDirectory}
      />
      <TerminalPane key={selected.id} tab={selected} isActive={isActive} />
    </div>
  );
};
