// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PageTrailContext } from '@goodboy/ui';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_SESSION } from '../../../../test/planFixtures';
import { seedPlanDrawer } from '../../../../test/planDrawerFixtures';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { heldDraftStore } from '../../../plans/planComments/heldDraftStore';
import { ArtifactDocumentShell } from './ArtifactDocumentShell';

const PINNED_PX = 96;
const BACK_LABEL = 'Back to artifacts';

let observers: FakeResizeObservers;

beforeEach(() => {
  observers = installFakeResizeObserver();
});

afterEach(() => {
  cleanup();
  heldDraftStore.clear();
});

const renderPage = () => {
  const { plan, stored } = seedPlanDrawer({ run: 'none' });
  const subject = { kind: 'plan', plan, artifact: stored } as const;
  return render(
    <ToastProvider>
      <PageTrailContext.Provider value={<button type="button">{BACK_LABEL}</button>}>
        <ArtifactDocumentShell sessionId={PLAN_FIXTURE_SESSION} subject={subject} agents={[]} />
      </PageTrailContext.Provider>
    </ToastProvider>,
  );
};

type ClosestParams = {
  readonly node: Element;
  readonly selector: string;
};

const closest = ({ node, selector }: ClosestParams): HTMLElement => {
  const match = node.closest<HTMLElement>(selector);
  if (match === null) {
    throw new Error(`no ${selector}`);
  }
  return match;
};

const pinnedZone = async (): Promise<HTMLElement> =>
  closest({
    node: await screen.findByTestId('artifact-shell-header'),
    selector: '[data-slot="reveal-pinned"]',
  });

describe('ArtifactDocumentShell pinned zone', () => {
  it('pins the back row and the status bar together, with nothing left to step aside', async () => {
    renderPage();

    const zone = await pinnedZone();
    expect(zone.contains(screen.getByRole('button', { name: BACK_LABEL }))).toBe(true);
    const region = closest({ node: zone, selector: '[data-slot="reveal-region"]' });
    expect(region.querySelector('[data-slot="reveal-header"]')?.childElementCount).toBe(0);
    const header = closest({
      node: screen.getByTestId('artifact-shell-header'),
      selector: '[data-slot="pane-header"]',
    });
    expect(header.hasAttribute('data-pinned')).toBe(true);
  });

  it('runs the document scroller under the zone, inset by its measured height', async () => {
    renderPage();

    const zone = await pinnedZone();
    const overlay = closest({ node: zone, selector: '[data-slot="reveal-overlay"]' });
    Object.defineProperty(overlay, 'offsetHeight', { configurable: true, value: PINNED_PX });
    observers.resizeAll();

    const region = closest({ node: zone, selector: '[data-slot="reveal-region"]' });
    expect(region.style.getPropertyValue('--reveal-inset')).toBe(`${PINNED_PX}px`);
    expect(region.style.getPropertyValue('--reveal-pad')).toBe('0px');
    const scroller = closest({
      node: screen.getByTestId('artifact-shell'),
      selector: '[data-page-scroller]',
    });
    expect(region.contains(scroller)).toBe(true);
    expect(overlay.contains(scroller)).toBe(false);
  });
});
