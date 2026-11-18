import { useEffect, useState } from 'react';
import { PaletteOverlay } from '../../../../../features/palette/components/PaletteOverlay';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SCRIPTS_BRANCH_SCRIPT_NAME, seedScriptsBranchStep } from './seedScriptsBranchStep';

const noop = (): void => undefined;

export const ScriptsBranchStepScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedScriptsBranchStep();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const input = document.querySelector('[role="combobox"]');
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <PaletteOverlay initialQuery={SCRIPTS_BRANCH_SCRIPT_NAME} onClose={noop} />
      </main>
    </ToastProvider>
  );
};
