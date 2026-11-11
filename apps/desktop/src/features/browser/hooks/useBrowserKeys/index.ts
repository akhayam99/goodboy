import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { stepTab } from '../../stepTab';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
  readonly isOn: boolean;
  readonly onFind: () => void;
};

type StepParams = {
  readonly step: 1 | -1;
};

export const useBrowserKeys = ({ model, isOn, onFind }: Params): void => {
  const currentId = model.shown?.tab.id ?? null;

  const go = ({ step }: StepParams): void => {
    const target = stepTab({ pins: model.pins, tabs: model.tabs, currentId, step });
    if (target === null || target.id === currentId) {
      return;
    }
    model.select({ tab: target });
  };

  useShortcut('browser.newTab', model.startDraft, isOn);
  useShortcut('browser.reopenTab', model.reopen, isOn);
  useShortcut('browser.prevTab', () => go({ step: -1 }), isOn);
  useShortcut('browser.nextTab', () => go({ step: 1 }), isOn);
  useShortcut('browser.pin', model.togglePin, isOn);
  useShortcut('browser.find', onFind, isOn);
  useShortcut(
    'browser.reload',
    () => {
      if (model.shown === null) {
        return false;
      }
      model.reload();
      return true;
    },
    isOn,
    { canDecline: true },
  );
  useShortcut(
    'browser.closeTab',
    () => {
      if (model.shown === null) {
        return false;
      }
      if (!model.shown.isPin) {
        model.close({ tab: model.shown.tab });
      }
      return true;
    },
    isOn,
    { canDecline: true },
  );
};
