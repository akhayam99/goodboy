import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import type { Location, SessionView } from '../../store/slices/navigation/types';

const SETTLE_MS = 2_000;

type SceneParams = {
  readonly name: string;
};

type PartParams = {
  readonly selector: string;
};

type NameParams = {
  readonly name: string | RegExp;
};

export type SceneJourney = {
  readonly view: () => SessionView;
  readonly store: () => StoryStore;
  readonly mount: (params: SceneParams) => Promise<void>;
  readonly settle: () => Promise<void>;
  readonly location: () => Location;
  readonly partOf: (params: PartParams) => HTMLElement;
  readonly crumbsOf: () => ReadonlyArray<string>;
  readonly tabsOf: () => ReadonlyArray<string>;
  readonly selectedTabOf: () => string | null;
  readonly clickButton: (params: NameParams) => Promise<void>;
  readonly clickTab: (params: NameParams) => Promise<void>;
};

export const installSceneJourney = (): SceneJourney => {
  let useAppStore: StoryStore;

  beforeAll(async () => {
    useAppStore = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    storySpies.tauriInvoke.mockImplementation((command, args) =>
      sceneInvoke({ command: String(command), args }),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    clearSceneInvoke();
  });

  const settle = async (): Promise<void> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
  };

  const mount = async ({ name }: SceneParams): Promise<void> => {
    const Scene = MOCK_SCENES[name];
    if (Scene === undefined) {
      throw new Error(`no scene ${name}`);
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await settle();
    if (screen.queryByText('Something went wrong') !== null) {
      throw new Error(`scene ${name} crashed`);
    }
  };

  const partOf = ({ selector }: PartParams): HTMLElement => {
    const part = document.querySelector<HTMLElement>(selector);
    if (part === null) {
      throw new Error(`no ${selector}`);
    }
    return part;
  };

  const crumbsOf = (): ReadonlyArray<string> => {
    const crumbs = screen.queryByRole('navigation', { name: 'Breadcrumb' });
    return crumbs === null
      ? []
      : within(crumbs)
          .getAllByRole('listitem')
          .map((item) => item.textContent ?? '');
  };

  const tabsOf = (): ReadonlyArray<string> => {
    const tabs = screen.queryByRole('tablist', { name: 'Session pages' });
    return tabs === null
      ? []
      : within(tabs)
          .getAllByRole('tab')
          .map((tab) => (tab.textContent ?? '').replace(/\d+$/, ''));
  };

  const selectedTabOf = (): string | null => {
    const tabs = screen.queryByRole('tablist', { name: 'Session pages' });
    const selected =
      tabs === null
        ? undefined
        : within(tabs)
            .getAllByRole('tab')
            .find((tab) => tab.getAttribute('aria-selected') === 'true');
    return selected === undefined ? null : (selected.textContent ?? '').replace(/\d+$/, '');
  };

  const clickButton = async ({ name }: NameParams): Promise<void> => {
    const button = screen.getAllByRole('button', { name }).at(-1);
    if (button === undefined) {
      throw new Error(`no button ${String(name)}`);
    }
    await act(async () => {
      button.click();
      await vi.advanceTimersByTimeAsync(400);
    });
  };

  const clickTab = async ({ name }: NameParams): Promise<void> => {
    const tab = within(screen.getByRole('tablist', { name: 'Session pages' })).getByRole('tab', {
      name,
    });
    await act(async () => {
      tab.click();
      await vi.advanceTimersByTimeAsync(400);
    });
  };

  return {
    store: () => useAppStore,
    mount,
    settle,
    location: () => captureLocation({ state: useAppStore.getState() }),
    view: () => {
      const { place } = captureLocation({ state: useAppStore.getState() });
      if (place.at !== 'session') {
        throw new Error('the place is not a session');
      }
      return place.view;
    },
    partOf,
    crumbsOf,
    tabsOf,
    selectedTabOf,
    clickButton,
    clickTab,
  };
};
