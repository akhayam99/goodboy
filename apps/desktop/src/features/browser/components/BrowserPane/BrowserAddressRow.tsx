import { ArrowLeft, ArrowRight, PanelLeft, Pin, RotateCw, X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserMoreMenu } from './BrowserMoreMenu';

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly isListOpen?: boolean;
  readonly onToggleList?: () => void;
  readonly onOpenAsPage?: () => void;
  readonly onClose?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  isListOpen = false,
  onToggleList,
  onOpenAsPage,
  onClose,
}: Props) => {
  const canStep = model.shown !== null;
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-2">
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
        disabled={!canStep}
        onClick={model.back}
      />
      <IconButton
        icon={ArrowRight}
        label="Forward"
        tooltipSide="top"
        disabled={!canStep}
        onClick={model.forward}
      />
      <IconButton
        icon={RotateCw}
        label="Reload"
        tooltipSide="top"
        disabled={!canStep}
        onClick={model.reload}
      />
      <BrowserAddressPill model={model} isAddressShortcutOn={isAddressShortcutOn} />
      {model.shown === null || model.projectName === null ? null : (
        <IconButton
          icon={Pin}
          label={
            model.shown.isPin ? `Unpin from ${model.projectName}` : `Pin to ${model.projectName}`
          }
          aria-pressed={model.shown.isPin}
          tooltipSide="top"
          onClick={model.togglePin}
        />
      )}
      <BrowserMoreMenu model={model} onOpenAsPage={onOpenAsPage} />
      {onClose === undefined ? null : (
        <IconButton icon={X} label="Close" tooltipSide="top" onClick={onClose} />
      )}
    </div>
  );
};
