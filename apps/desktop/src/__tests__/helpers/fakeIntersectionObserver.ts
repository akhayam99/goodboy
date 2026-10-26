import { act } from '@testing-library/react';
import { vi } from 'vitest';

type Entry = {
  readonly target: Element;
  readonly isIntersecting: boolean;
};

type Callback = (entries: ReadonlyArray<Entry>) => void;

type Observer = {
  readonly callback: Callback;
  readonly targets: Set<Element>;
};

type ShowParams = {
  readonly attribute: string;
  readonly keys: ReadonlyArray<string>;
};

export type FakeIntersectionObserver = {
  readonly show: (params: ShowParams) => void;
  readonly restore: () => void;
};

export const installFakeIntersectionObserver = (): FakeIntersectionObserver => {
  const observers = new Set<Observer>();

  vi.stubGlobal('IntersectionObserver', function FakeIntersectionObserver(callback: Callback) {
    const observer: Observer = { callback, targets: new Set() };
    observers.add(observer);
    return {
      observe: (target: Element) => {
        observer.targets.add(target);
      },
      unobserve: (target: Element) => {
        observer.targets.delete(target);
      },
      disconnect: () => {
        observers.delete(observer);
      },
      takeRecords: () => [],
    };
  });

  return {
    show: ({ attribute, keys }) => {
      act(() => {
        for (const observer of observers) {
          observer.callback(
            [...observer.targets].map((target) => ({
              target,
              isIntersecting: keys.includes(target.getAttribute(attribute) ?? ''),
            })),
          );
        }
      });
    },
    restore: () => {
      observers.clear();
      vi.unstubAllGlobals();
    },
  };
};
