import { useEffect } from 'react';

export const useEscapeToCloseDialog = (): void => {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      e.preventDefault();
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      dialogs[dialogs.length - 1]?.close();
    };
    document.addEventListener('keydown', onEsc, { capture: true });
    return () => document.removeEventListener('keydown', onEsc, { capture: true });
  }, []);
};
