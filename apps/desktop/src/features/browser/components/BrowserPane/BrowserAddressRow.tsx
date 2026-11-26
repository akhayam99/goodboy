import {
  ArrowLeft,
  ArrowRight,
  CodeXml,
  Pin,
  RotateCw,
  Square,
  SquareDashedMousePointer,
} from '@goodboy/ui/icons';
import { IconButton, PANE_RHYTHM, cn } from '@goodboy/ui';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useBrowserKeys } from '../../hooks/useBrowserKeys';
import { useCommandField } from '../../hooks/useCommandField';
import type { ElementPick } from '../../hooks/useElementPick';
import { useFindInPage } from '../../hooks/useFindInPage';
import type { BrowserConsoleToggle, BrowserErrorsShow, BrowserPaneModel } from '../../types';
import { BrowserCommandPanel } from './BrowserCommandPanel';
import { BrowserErrorCount } from './BrowserErrorCount';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserLoadLine } from './BrowserLoadLine';
import { BrowserMoreMenu } from './BrowserMoreMenu';
import { BrowserTabStrip, type BrowserStripGroups } from './BrowserTabStrip';
import { foldedBrowserRowsOf } from './foldedBrowserRowsOf';
import { NAMES } from '../../../../shared/utils/names';
import { DockButton } from '../../../../shared/components/DockButton';

const NARROW_ROW_PX = 560;

const RELOAD_TOOLTIP = 'Reload. Shift click reloads without cache';

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly consoleToggle?: BrowserConsoleToggle;
  readonly errors?: BrowserErrorsShow;
  readonly pick?: ElementPick;
  readonly page?: BrowserStripGroups;
  readonly onOpenAsPage?: () => void;
  readonly onDock?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  consoleToggle,
  errors,
  pick,
  page,
  onOpenAsPage,
  onDock,
}: Props) => {
  const canStep = model.shown !== null;
  const field = useCommandField({ model });
  const find = useFindInPage({ model });
  const { ref: rowRef, width } = useElementWidth();
  const isFolded = width !== null && width > 0 && width < NARROW_ROW_PX;
  const folded = isFolded ? foldedBrowserRowsOf({ model }) : [];
  useBrowserKeys({ model, isOn: isAddressShortcutOn, onFind: find.open });
  useShortcut('browser.address', field.edit, isAddressShortcutOn);
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
  useShortcut(
    'browser.pick',
    () => {
      if (pick === undefined || (!pick.canPick && !pick.isPicking)) {
        return false;
      }
      pick.toggle();
      return true;
    },
    isAddressShortcutOn && pick !== undefined,
    { canDecline: true },
  );
  return (
    <>
      <div
        ref={rowRef}
        data-grid-row="1"
        data-browser-row=""
        data-row-folded={isFolded ? '' : undefined}
        className={cn('relative flex shrink-0 items-center gap-0.5 px-2', PANE_RHYTHM.firstRow)}
      >
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
            tooltip={RELOAD_TOOLTIP}
            tooltipSide="top"
            disabled={!canStep}
            onClick={(event) => {
              if (event.shiftKey) {
                model.reloadFromOrigin();
                return;
              }
              model.reload();
            }}
          />
        )}
        <BrowserTabStrip model={model} field={field} page={page} />
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
        {errors === undefined || model.shown === null ? null : (
          <BrowserErrorCount errors={errors} />
        )}
        {pick === undefined ? null : (
          <IconButton
            icon={SquareDashedMousePointer}
            label="Select an element"
            aria-pressed={pick.isPicking}
            shortcut="browser.pick"
            tooltipSide="top"
            disabled={!pick.canPick && !pick.isPicking}
            onClick={pick.toggle}
          />
        )}
        {consoleToggle === undefined ? null : (
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
        {onDock === undefined ? null : (
          <DockButton tooltip={NAMES.dockBesideThePage} onDock={onDock} />
        )}
        {model.isLoading ? <BrowserLoadLine /> : null}
        {field.isOpen ? <BrowserCommandPanel model={model} field={field} /> : null}
      </div>
      {find.isOpen ? <BrowserFindBar find={find} /> : null}
    </>
  );
};
