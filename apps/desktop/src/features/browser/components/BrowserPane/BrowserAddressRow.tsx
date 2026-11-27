import { ArrowLeft, ArrowRight, RotateCw, Square } from '@goodboy/ui/icons';
import { IconButton, PANE_RHYTHM, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useBrowserKeys } from '../../hooks/useBrowserKeys';
import type { BrowserTools } from '../../hooks/useBrowserTools';
import { useCommandField } from '../../hooks/useCommandField';
import type { ElementPick } from '../../hooks/useElementPick';
import { useFindInPage } from '../../hooks/useFindInPage';
import { NARROW_ROW_PX } from '../../narrowRowPx';
import type { BrowserPaneModel } from '../../types';
import { BrowserCommandPanel } from './BrowserCommandPanel';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserLoadLine } from './BrowserLoadLine';
import { BrowserTabStrip, type BrowserStripGroups } from './BrowserTabStrip';
import { BrowserToolsCapsule } from './BrowserToolsCapsule';
import { NAMES } from '../../../../shared/utils/names';
import { DockButton } from '../../../../shared/components/DockButton';

const RELOAD_TOOLTIP = `Reload. Shift click or ${shortcutGlyphs('app.reload')} reloads without cache`;

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly tools?: BrowserTools;
  readonly pick?: ElementPick;
  readonly page?: BrowserStripGroups;
  readonly onDock?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  tools,
  pick,
  page,
  onDock,
}: Props) => {
  const canStep = model.shown !== null;
  const field = useCommandField({ model });
  const find = useFindInPage({ model });
  const { ref: rowRef, width } = useElementWidth();
  const isNarrow = width !== null && width > 0 && width < NARROW_ROW_PX;
  useBrowserKeys({ model, isOn: isAddressShortcutOn, onFind: find.open });
  useShortcut('browser.address', field.edit, isAddressShortcutOn);
  useShortcut(
    'browser.console',
    () => {
      if (tools === undefined || model.shown === null) {
        return false;
      }
      tools.toggle({ isByKey: true });
      return true;
    },
    isAddressShortcutOn && tools !== undefined,
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
        data-row-narrow={isNarrow ? '' : undefined}
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
            shortcut="view.reload"
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
        <BrowserTabStrip model={model} field={field} page={page} isNarrow={isNarrow} />
        <BrowserToolsCapsule tools={tools} pick={pick} hasTab={canStep} />
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
