// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  buildReportContext,
  collectReportContext,
  type ReportContext,
  type ReportContextSources,
} from '.';
import type { AppPlatform } from './appPlatform';

type ReportContextField = keyof ReportContext;

const REPORT_CONTEXT_FIELDS = [
  'version',
  'build',
  'system',
  'screen',
  'cliVersions',
] as const satisfies ReadonlyArray<ReportContextField>;

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.11.1' }));
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboarding-store', async () =>
  (await import('../../../store/storyHarness')).onboardingStoreModuleMock(),
);

const SESSION_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b' as SessionId;

const SECRET = 'ghp_AbCdEfGhIjKlMnOpQrStUv123456';

const EMAIL = 'rowan@example.dev';

const HOME = '/Users/rowan/code/harborline';

const PLATFORM: AppPlatform = {
  os: 'macos',
  osVersion: '15.1',
  arch: 'aarch64',
  buildSha: 'fc2f08994a1b',
};

const BASE_SOURCES: ReportContextSources = {
  version: '0.11.1',
  platform: PLATFORM,
  locationKey: 'board',
  providers: [],
};

const LEAKS: ReadonlyArray<string> = [SECRET, EMAIL, 'rowan', 'harborline'];

const FIELD_PROBES: Readonly<Record<ReportContextField, ReportContextSources>> = {
  version: { ...BASE_SOURCES, version: `0.11.1 ${SECRET} ${EMAIL} ${HOME}` },
  build: {
    ...BASE_SOURCES,
    platform: { ...PLATFORM, buildSha: `${SECRET} ${EMAIL} ${HOME}` },
  },
  system: {
    ...BASE_SOURCES,
    platform: { ...PLATFORM, osVersion: `${SECRET} ${EMAIL} ${HOME}` },
  },
  screen: { ...BASE_SOURCES, locationKey: `s/${EMAIL}/review/${SECRET}${HOME}` },
  cliVersions: {
    ...BASE_SOURCES,
    providers: [{ id: 'anthropic', version: `2.1.260 ${SECRET} ${EMAIL} ${HOME}` }],
  },
};

describe('buildReportContext', () => {
  it('carries exactly the approved fields', () => {
    const context = buildReportContext(BASE_SOURCES);
    expect(Object.keys(context)).toEqual([...REPORT_CONTEXT_FIELDS]);
  });

  it.each(REPORT_CONTEXT_FIELDS)('passes %s through redactReport', (field) => {
    const context = buildReportContext(FIELD_PROBES[field]);
    LEAKS.forEach((leak) => expect(context[field]).not.toContain(leak));
  });

  it('reads the version, build, system and cli versions as plain labels', () => {
    const context = buildReportContext({
      ...BASE_SOURCES,
      providers: [
        { id: 'anthropic', version: '2.1.260 (Claude Code)' },
        { id: 'codex', version: 'codex-cli 0.61.0' },
        { id: 'gemini', version: null },
      ],
    });
    expect(context).toEqual({
      version: '0.11.1',
      build: 'fc2f08994a1b',
      system: 'macOS 15.1 arm64',
      screen: 'Board',
      cliVersions: 'Claude CLI 2.1.260, Codex CLI 0.61.0',
    });
  });

  it('says what it does not know instead of guessing', () => {
    const context = buildReportContext({ ...BASE_SOURCES, version: null, platform: null });
    expect(context.version).toBe('unknown');
    expect(context.build).toBe('dev');
    expect(context.system).toBe('unknown');
    expect(context.cliVersions).toBe('none detected');
  });
});

describe('collectReportContext', () => {
  let store: StoryStore;

  beforeAll(async () => {
    store = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) => {
      if (command === 'app_platform') {
        return PLATFORM;
      }
      return null;
    });
  });

  it('reads the current screen and cli versions from the store', async () => {
    store.setState({
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: 'review' },
      providers: [{ id: 'anthropic', binary: 'claude', version: '2.1.260 (Claude Code)' } as never],
    });

    const context = await collectReportContext({ state: store.getState() });

    expect(context).toEqual({
      version: '0.11.1',
      build: 'fc2f08994a1b',
      system: 'macOS 15.1 arm64',
      screen: 'Session › Review',
      cliVersions: 'Claude CLI 2.1.260',
    });
    expect(Object.values(context).join('\n')).not.toContain(SESSION_ID);
  });

  it('still builds a context when the platform command fails', async () => {
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown) => {
      if (command === 'app_platform') {
        throw new Error('not available');
      }
      return null;
    });

    const context = await collectReportContext({ state: store.getState() });

    expect(context.system).toBe('unknown');
    expect(context.build).toBe('dev');
    expect(context.screen).toBe('Board');
  });
});
