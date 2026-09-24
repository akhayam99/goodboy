import { useEffect } from 'react';

type LabelMatch = 'prefix' | 'contains';

type MatchParams = {
  readonly text: string;
  readonly label: string;
  readonly match: LabelMatch;
};

const matchesLabel = ({ text, label, match }: MatchParams): boolean => {
  switch (match) {
    case 'prefix':
      return text.trim().startsWith(label);
    case 'contains':
      return text.includes(label);
    default: {
      const exhaustive: never = match;
      return exhaustive;
    }
  }
};

type Params = {
  readonly isReady: boolean;
  readonly labels: ReadonlyArray<string>;
  readonly selector: string;
  readonly match: LabelMatch;
  readonly intervalMs: number;
};

export const useSceneClicks = ({ isReady, labels, selector, match, intervalMs }: Params): void => {
  useEffect(() => {
    if (!isReady || labels.length === 0) {
      return;
    }
    let index = 0;
    const interval = window.setInterval(() => {
      const label = labels[index];
      if (label === undefined) {
        window.clearInterval(interval);
        return;
      }
      const target = [...window.document.querySelectorAll(selector)].find((candidate) =>
        matchesLabel({ text: candidate.textContent ?? '', label, match }),
      );
      if (!(target instanceof HTMLElement)) {
        return;
      }
      target.click();
      index += 1;
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, isReady, labels, match, selector]);
};
