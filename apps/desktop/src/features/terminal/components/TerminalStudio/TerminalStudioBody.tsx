import type { KeyboardEvent } from 'react';
import { StudioRailLayout } from '@goodboy/ui';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { pickerRowCount } from '../../pickerRowCount';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';
import { TerminalDetail } from './TerminalDetail';
import { TerminalPageHeader } from './TerminalPageHeader';
import { TerminalRail } from './TerminalRail';

type Props = {
  readonly model: TerminalStudioModel;
  readonly isActive: boolean;
};

export const TerminalStudioBody = ({ model, isActive }: Props) => {
  const hasPicker =
    model.groups.length > 0 && pickerRowCount({ clusters: model.pickerClusters }) > 1;
  useShortcut(
    'terminal.newHere',
    () => {
      if (hasPicker) {
        window.dispatchEvent(new CustomEvent(TERMINAL_PICKER_EVENTS.page));
        return;
      }
      model.openDefault();
    },
    isActive,
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      !isActive ||
      !eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['terminal.newTab'] })
    ) {
      return;
    }
    event.preventDefault();
    model.newTab();
  };
  return (
    <div onKeyDown={handleKeyDown} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <TerminalPageHeader />
      <StudioRailLayout
        railLabel="Terminals"
        railWidth="standard"
        surface="terminal"
        placement="page"
        rail={model.groups.length === 0 ? null : <TerminalRail model={model} />}
        detail={<TerminalDetail model={model} isActive={isActive} />}
      />
    </div>
  );
};
