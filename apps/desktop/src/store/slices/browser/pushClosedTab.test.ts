import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { pushClosedTab } from './pushClosedTab';
import type { BrowserTab, ClosedBrowserTab } from './types';

const tabOf = ({ index }: { readonly index: number }): BrowserTab => ({
  id: `tab-${index}`,
  sessionId: nextSessionId(),
  projectId: null,
  url: `https://acme.example/${index}`,
  title: `Acme ${index}`,
  position: index,
  createdAt: 1,
  updatedAt: 1,
});

describe('pushClosedTab', () => {
  it('puts the latest closed tab first and keeps only five', () => {
    const closed = [1, 2, 3, 4, 5, 6].reduce<ReadonlyArray<ClosedBrowserTab>>(
      (stack, index) => pushClosedTab({ closed: stack, tab: tabOf({ index }) }),
      [],
    );

    expect(closed.map((tab) => tab.url)).toEqual([
      'https://acme.example/6',
      'https://acme.example/5',
      'https://acme.example/4',
      'https://acme.example/3',
      'https://acme.example/2',
    ]);
  });

  it('keeps the stack when the closed tab is unknown', () => {
    const closed = [{ url: 'https://acme.example/1', title: 'Acme 1' }];

    expect(pushClosedTab({ closed, tab: undefined })).toBe(closed);
  });
});
