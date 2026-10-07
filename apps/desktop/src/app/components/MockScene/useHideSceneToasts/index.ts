import { useEffect } from 'react';

const HIDDEN_SCENE_TOASTS = ['File drop is unavailable'];

export const useHideSceneToasts = (): void => {
  useEffect(() => {
    const drop = () =>
      document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"]').forEach((node) => {
        if (HIDDEN_SCENE_TOASTS.some((text) => node.textContent?.includes(text))) {
          node.style.display = 'none';
        }
      });
    const observer = new MutationObserver(drop);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
};
