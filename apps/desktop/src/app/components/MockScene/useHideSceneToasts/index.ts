import { useEffect } from 'react';

const HIDDEN_SCENE_TOASTS = ['File drop is unavailable'];
const HIDDEN_DEMO_TOASTS = ['Run started', 'Fix run started', 'Session started'];

export const useHideSceneToasts = (): void => {
  useEffect(() => {
    const hidden = new URLSearchParams(window.location.search).has('director')
      ? [...HIDDEN_SCENE_TOASTS, ...HIDDEN_DEMO_TOASTS]
      : HIDDEN_SCENE_TOASTS;
    const drop = () =>
      document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"]').forEach((node) => {
        if (hidden.some((text) => node.textContent?.includes(text))) {
          node.style.display = 'none';
        }
      });
    const observer = new MutationObserver(drop);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
};
