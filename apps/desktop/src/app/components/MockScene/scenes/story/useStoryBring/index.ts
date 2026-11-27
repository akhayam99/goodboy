import { useEffect, useRef, useState } from 'react';
import {
  OPEN_WIZARD_EVENT,
  type OpenWizardDetail,
} from '../../../../../../features/onboarding/onboardingSettings';
import { isTypingTarget } from '../../../../../../shared/keyboard/isTypingTarget';
import { seedWizardScene } from '../../onboarding/wizardSceneSeed';
import { useAppStore } from '../../../../../../store';
import { landOnTasks } from '../landOnTasks';
import { storyBringAnswer } from '../storyBringIpc';
import { STORY_TASK_COUNT } from '../storyTasks';

const WIZARD = '[aria-label="Goodboy setup"]';
const CONTINUE = `${WIZARD}[data-step="tools"] [data-demo-anchor="setup-continue"]`;
const TOOLS_STEP = `${WIZARD}[data-step="tools"]`;
const LEAVE = `${WIZARD} header button`;
const CHOOSE_FOLDER = `${WIZARD}[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]`;
const TASK_ROWS = '[role="option"]';
const POLL_MS = 80;
const WATCH_MS = 200;
const LIST_WAIT_MS = 5000;
const SETTLE_FRAMES = 2;

type SceneStatus = {
  readonly isReady: boolean;
  readonly isLanded: boolean;
};

type WaitParams = {
  readonly isDone: () => boolean;
  readonly limitMs: number;
};

const waitUntil = ({ isDone, limitMs }: WaitParams): Promise<void> =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (!isDone() && Date.now() - startedAt < limitMs) {
        return;
      }
      window.clearInterval(timer);
      resolve();
    }, POLL_MS);
  });

const waitFrames = async (): Promise<void> => {
  for (let frame = 0; frame < SETTLE_FRAMES; frame += 1) {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }
};

const isListLoaded = (): boolean => document.querySelectorAll(TASK_ROWS).length >= STORY_TASK_COUNT;

type EnterParams = {
  readonly event: KeyboardEvent;
};

const isPlainEnter = ({ event }: EnterParams): boolean =>
  event.key === 'Enter' &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey &&
  !event.isComposing &&
  !isTypingTarget(event.target) &&
  !(event.target instanceof HTMLButtonElement);

export const useStoryBring = (): SceneStatus => {
  const [isReady, setIsReady] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const isLandedRef = useRef(false);
  const isLeavingRef = useRef(false);

  useEffect(() => {
    seedWizardScene({
      agents: 'ready',
      ws: 'none',
      hasLinear: false,
      hasGithub: false,
      answer: ({ command, payload }) =>
        storyBringAnswer({ command, payload, isLanded: isLandedRef.current }),
    });
    useAppStore.setState({
      openSessionDraft: () => undefined,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (document.querySelector(WIZARD) !== null) {
      return;
    }
    const detail: OpenWizardDetail = { mode: 'full', step: 'agents' };
    window.dispatchEvent(new CustomEvent(OPEN_WIZARD_EVENT, { detail }));
  }, [isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setInterval(() => {
      const choose = document.querySelector<HTMLElement>(CHOOSE_FOLDER);
      if (choose === null) {
        return;
      }
      window.clearInterval(timer);
      choose.click();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const leave = async (): Promise<void> => {
      await waitUntil({ isDone: isListLoaded, limitMs: LIST_WAIT_MS });
      await waitFrames();
      const button = document.querySelector<HTMLElement>(LEAVE);
      isLeavingRef.current = true;
      button?.click();
    };
    const land = (): void => {
      if (isLandedRef.current) {
        return;
      }
      isLandedRef.current = true;
      landOnTasks();
      setIsLanded(true);
      void leave();
    };
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    let wasWizardOpen = false;
    let keyedDialog: HTMLElement | null = null;
    const bindKeys = (): void => {
      const dialog = document.querySelector<HTMLElement>(WIZARD);
      if (dialog === null || dialog === keyedDialog) {
        return;
      }
      keyedDialog = dialog;
      dialog.addEventListener(
        'keydown',
        (event) => {
          if (isLandedRef.current || !isPlainEnter({ event })) {
            return;
          }
          if (document.querySelector(TOOLS_STEP) === null) {
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          land();
        },
        options,
      );
    };
    const watch = window.setInterval(() => {
      bindKeys();
      if (document.querySelector(WIZARD) !== null) {
        wasWizardOpen = true;
        return;
      }
      if (wasWizardOpen && !isLandedRef.current) {
        isLeavingRef.current = true;
        land();
      }
    }, WATCH_MS);
    bindKeys();
    document.addEventListener(
      'click',
      (event) => {
        if (isLeavingRef.current || !(event.target instanceof Element)) {
          return;
        }
        if (event.target.closest(CONTINUE) === null && event.target.closest(LEAVE) === null) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        land();
      },
      options,
    );
    return () => {
      window.clearInterval(watch);
      listeners.abort();
    };
  }, [isReady]);

  return { isReady, isLanded };
};
