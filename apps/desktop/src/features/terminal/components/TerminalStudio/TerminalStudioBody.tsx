import type { KeyboardEvent } from 'react';
import { useStudioRailFold, StudioRailLayout } from '@goodboy/ui';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { TerminalDetail } from './TerminalDetail';
import { TerminalRail } from './TerminalRail';

type Props = {
  readonly model: TerminalStudioModel;
  readonly isActive: boolean;
};

export const TerminalStudioBody = ({ model, isActive }: Props) => {
  const fold = useStudioRailFold({ surface: 'terminal' });
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      !isActive ||
      !eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['terminal.newTab'] })
    ) {
      return;
    }
    event.preventDefault();
    model.openDefault();
  };
  return (
    <div
      ref={fold.paneRef}
      onKeyDown={handleKeyDown}
      className="flex h-full min-h-0 min-w-0 flex-1"
    >
      <StudioRailLayout
        railLabel="Terminals"
        railWidth="standard"
        surface="terminal"
        placement="page"
        rail={<TerminalRail model={model} />}
        isCollapsed={fold.isCollapsed}
        onCollapsedChange={fold.setFolded}
        detail={
          <TerminalDetail
            model={model}
            isActive={isActive}
            onDock={fold.isCollapsed && fold.canDock ? () => fold.setFolded(false) : undefined}
          />
        }
      />
    </div>
  );
};
