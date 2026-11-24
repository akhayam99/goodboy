import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CodeXml,
  GripVertical,
  PanelLeft,
  Pin,
  RotateCw,
  Square,
  X,
} from '@goodboy/ui/icons';
import { ICON_SIZE, IconButton, PANE_RHYTHM, cn, useDockGrip } from '@goodboy/ui';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useBrowserKeys } from '../../hooks/useBrowserKeys';
import { useCommandField } from '../../hooks/useCommandField';
import { useFindInPage } from '../../hooks/useFindInPage';
import type { BrowserConsoleToggle, BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserCommandPanel } from './BrowserCommandPanel';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserLoadLine } from './BrowserLoadLine';
import { BrowserMoreMenu } from './BrowserMoreMenu';
import { foldedBrowserRowsOf } from './foldedBrowserRowsOf';
import { NAMES } from '../../../../shared/utils/names';
import { DockButton } from '../../../../shared/components/DockButton';

const NARROW_ROW_PX = 520;

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly isListOpen?: boolean;
  readonly consoleToggle?: BrowserConsoleToggle;
  readonly onToggleList?: () => void;
  readonly onOpenAsPage?: () => void;
  readonly onDock?: () => void;
  readonly onClose?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  isListOpen = false,
  consoleToggle,
  onToggleList,
  onOpenAsPage,
  onDock,
  onClose,
}: Props) => {
  const canStep = model.shown !== null;
  const field = useCommandField({ model });
  const find = useFindInPage({ model });
  const grip = useDockGrip();
  const { ref: rowRef, width } = useElementWidth();
  const isFolded = width !== null && width > 0 && width < NARROW_ROW_PX;
  const folded = isFolded ? foldedBrowserRowsOf({ model, consoleToggle }) : [];
  useBrowserKeys({ model, isOn: isAddressShortcutOn, onFind: find.open });
  useShortcut(
    'browser.console',
    () => {
      if (consoleToggle === undefined || model.shown === null) {
        return false;
      }
      consoleToggle.onToggle();
      return true;
    },
    isAddressShortcutOn && consoleToggle !== undefined,
    { canDecline: true },
  );
  return (
    <>
      <div
        ref={rowRef}
        data-grid-row="1"
        data-dock-drag-source={grip.canDrag ? '' : undefined}
        data-row-folded={isFolded ? '' : undefined}
        onPointerDown={grip.canDrag ? (event) => grip.press({ event }) : undefined}
        className={cn(
          'relative flex shrink-0 items-center gap-1 px-2',
          PANE_RHYTHM.firstRow,
          grip.canDrag && 'cursor-grab',
        )}
      >
        {grip.canDrag ? (
          <GripVertical
            size={ICON_SIZE.row}
            aria-hidden
            data-dock-grip=""
            className="shrink-0 text-faint-foreground"
          />
        ) : null}
        {onToggleList === undefined ? null : (
          <IconButton
            icon={PanelLeft}
            label={isListOpen ? 'Hide tab list' : 'Show tab list'}
            aria-pressed={isListOpen}
            tooltipSide="top"
            onClick={onToggleList}
          />
        )}
        <IconButton
          icon={ArrowLeft}
          label="Back"
          tooltipSide="top"
          disabled={!canStep || !model.canGoBack}
          onClick={model.back}
        />
        <IconButton
          icon={ArrowRight}
          label="Forward"
          tooltipSide="top"
          disabled={!canStep || !model.canGoForward}
          onClick={model.forward}
        />
        {model.isLoading ? (
          <IconButton icon={Square} label="Stop" tooltipSide="top" onClick={model.stop} />
        ) : (
          <IconButton
            icon={RotateCw}
            label="Reload"
            tooltipSide="top"
            disabled={!canStep}
            onClick={model.reload}
          />
        )}
        <BrowserAddressPill model={model} field={field} isAddressShortcutOn={isAddressShortcutOn} />
        {isFolded || model.shown === null || model.projectName === null ? null : (
          <IconButton
            icon={Pin}
            label={
              model.shown.isPin ? `Unpin from ${model.projectName}` : `Pin to ${model.projectName}`
            }
            aria-pressed={model.shown.isPin}
            shortcut="browser.pin"
            tooltipSide="top"
            onClick={model.togglePin}
          />
        )}
        {isFolded || consoleToggle === undefined ? null : (
          <IconButton
            icon={CodeXml}
            label="Console"
            aria-pressed={consoleToggle.isOpen}
            shortcut="browser.console"
            tooltipSide="top"
            disabled={!canStep}
            onClick={consoleToggle.onToggle}
          />
        )}
        <BrowserMoreMenu model={model} folded={folded} onOpenAsPage={onOpenAsPage} />
        {isFolded || onOpenAsPage === undefined ? null : (
          <IconButton
            icon={ArrowUpRight}
            label={NAMES.openFullPage}
            tooltipSide="top"
            onClick={onOpenAsPage}
          />
        )}
        {onDock === undefined ? null : (
          <DockButton tooltip={NAMES.dockBesideThePage} onDock={onDock} />
        )}
        {onClose === undefined ? null : (
          <IconButton icon={X} label="Close" tooltipSide="top" onClick={onClose} />
        )}
        {model.isLoading ? <BrowserLoadLine /> : null}
        {field.isOpen ? <BrowserCommandPanel model={model} field={field} /> : null}
      </div>
      {find.isOpen ? <BrowserFindBar find={find} /> : null}
    </>
  );
};
