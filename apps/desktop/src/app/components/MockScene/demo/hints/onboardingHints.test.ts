// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { ONBOARDING_HINTS } from './onboardingHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation(() => new Promise<never>(() => undefined));
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const dwell = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(4600);
};

type ScreenParams = {
  readonly step: string;
  readonly html: string;
};

const screen = ({ step, html }: ScreenParams): void => {
  document.body.innerHTML = `<div aria-label="Goodboy setup" data-step="${step}">${html}</div>`;
};

const WHEN = brandId<IsoDateTime>({ value: '2026-10-26T09:00:00.000Z' });

const LINEAR: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-linear' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-linear' }),
  provider: 'linear',
  config: { workspaceUrlKey: 'harborline', viewerUserId: 'dana', viewerName: 'Dana R.' },
  createdAt: WHEN,
  updatedAt: WHEN,
};

const STARTERS = `
  <div role="group" aria-label="Starters">
    <button type="button" aria-pressed="true">Explain how payments-api is organized</button>
    <button type="button" aria-pressed="false">Find one small bug</button>
    <button type="button" aria-pressed="false">What's missing in the README</button>
  </div>
`;

describe('the Set up steps', () => {
  it('walks the wizard in order, credits each action once and ends on a started task', async () => {
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => ONBOARDING_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    const shown = (): string | null =>
      reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : [])).at(-1) ?? null;
    screen({
      step: 'welcome',
      html: '<button type="button" data-demo-anchor="setup-start">Get started</button>',
    });
    engine.setTrack({ chapterId: 'setup', settledIds: [] });
    await frame();
    expect(shown()).toBe('setup-start');

    screen({
      step: 'agents',
      html: '<button type="button" data-demo-anchor="setup-continue">Continue</button>',
    });
    await frame();
    expect(tried()).toEqual(['setup-start']);
    await dwell();
    expect(shown()).toBe('setup-agents');

    screen({
      step: 'workspace',
      html: '<button type="button" data-demo-anchor="setup-choose-folder">Choose folder</button>',
    });
    await frame();
    await dwell();
    expect(shown()).toBe('setup-workspace');
    screen({
      step: 'workspace',
      html: '<button type="submit" data-demo-anchor="setup-create">Create</button>',
    });
    await frame();
    await dwell();
    expect(shown()).toBe('setup-create');

    screen({
      step: 'tools',
      html: `
        <button type="button" aria-label="Connect Linear">Connect</button>
        <button type="button" data-demo-anchor="setup-continue">Continue</button>
      `,
    });
    await frame();
    expect(tried()).toEqual(['setup-start', 'setup-agents', 'setup-workspace', 'setup-create']);
    await dwell();
    expect(shown()).toBe('setup-linear');
    store.setState({ workspaceIntegrations: { [LINEAR.workspaceId]: [LINEAR] } });
    await frame();
    expect(tried().at(-1)).toBe('setup-linear');
    await dwell();
    expect(shown()).toBe('setup-tools');

    screen({
      step: 'first-session',
      html: `${STARTERS}<button type="button" data-demo-anchor="setup-first-start">Start</button>`,
    });
    await frame();
    await dwell();
    expect(shown()).toBe('setup-bug');
    document
      .querySelector('[aria-label="Starters"] > button:nth-of-type(2)')
      ?.setAttribute('aria-pressed', 'true');
    await frame();
    await dwell();
    expect(shown()).toBe('setup-first-start');

    const started = aSession({ goal: 'Find one small bug' });
    store.setState({ sessions: [started], currentSessionId: started.id });
    await frame();
    expect(tried()).toEqual([
      'setup-start',
      'setup-agents',
      'setup-workspace',
      'setup-create',
      'setup-linear',
      'setup-tools',
      'setup-bug',
      'setup-first-start',
    ]);
    engine.dispose();
  });

  it('never leaves the first task stuck when the visitor takes the issue route', async () => {
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => ONBOARDING_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    screen({
      step: 'first-session',
      html: `
        <div role="tablist"><button role="tab" aria-selected="false">Ask about the code</button>
        <button role="tab" aria-selected="true">Pick up an issue</button></div>
        <button type="button" data-demo-anchor="setup-first-start">Draft the brief</button>
      `,
    });
    engine.setTrack({
      chapterId: 'setup',
      settledIds: ONBOARDING_HINTS.slice(0, 6).map((entry) => entry.id),
    });
    await frame();
    expect(tried()).toEqual(['setup-bug']);
    engine.dispose();
  });
});
