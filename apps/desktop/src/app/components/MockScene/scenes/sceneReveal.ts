import { useEffect } from 'react';

const POLL_MS = 150;
const HOVER_ATTRIBUTE = 'data-scene-hover';
const HOVER_STYLE_ID = 'scene-hover-style';
const HOVER_STYLE = [
  `[${HOVER_ATTRIBUTE}] .group-hover\\/mount-row\\:opacity-100 { opacity: 1; transition: none; }`,
  `[${HOVER_ATTRIBUTE}] > div:first-child { background-color: color-mix(in oklch, var(--color-muted) 40%, transparent); }`,
].join('\n');

type RevealParams = Readonly<{
  isReady: boolean;
}>;

type HoverParams = Readonly<{
  isReady: boolean;
  rowLabel: string;
}>;

const pollUntil = (attempt: () => boolean): (() => void) => {
  const interval = window.setInterval(() => {
    if (attempt()) {
      window.clearInterval(interval);
    }
  }, POLL_MS);
  return () => window.clearInterval(interval);
};

export const useShowCompletedMounts = ({ isReady }: RevealParams) => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    return pollUntil(() => {
      const toggle = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.startsWith('Show completed'),
      );
      if (toggle === undefined) {
        return false;
      }
      toggle.click();
      return true;
    });
  }, [isReady]);
};

export const useHoveredMountRow = ({ isReady, rowLabel }: HoverParams) => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (document.getElementById(HOVER_STYLE_ID) === null) {
      const style = document.createElement('style');
      style.id = HOVER_STYLE_ID;
      style.textContent = HOVER_STYLE;
      document.head.appendChild(style);
    }
    return pollUntil(() => {
      const row = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="project-mount-row"]'),
      ].find((element) => element.textContent?.includes(rowLabel));
      if (row !== undefined && !row.hasAttribute(HOVER_ATTRIBUTE)) {
        row.setAttribute(HOVER_ATTRIBUTE, '');
      }
      return false;
    });
  }, [isReady, rowLabel]);
};
