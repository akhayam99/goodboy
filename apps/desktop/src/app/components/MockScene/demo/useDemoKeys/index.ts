import { useCallback, type KeyboardEvent } from 'react';
import { isTypingTarget } from '../../../../../shared/keyboard/isTypingTarget';
import { currentPlatform } from '../../../../../shared/platform';
import type { DemoShortcutCode } from '../director/demoProtocol';

export type FrameShortcutParams = {
  readonly code: DemoShortcutCode;
};

type Params = {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onReplay: () => void;
  readonly onPreviousStep: () => void;
  readonly onNextStep: () => void;
  readonly onShowHint: () => void;
  readonly onFrameShortcut: (params: FrameShortcutParams) => void;
};

const FRAME_SHORTCUTS: ReadonlyMap<string, DemoShortcutCode> = new Map<string, DemoShortcutCode>([
  ['KeyK', 'KeyK'],
  ['KeyF', 'KeyF'],
  ['KeyB', 'KeyB'],
]);

type ShortcutOfParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

const frameShortcutOf = ({ event }: ShortcutOfParams): DemoShortcutCode | undefined => {
  const isMac = currentPlatform() === 'darwin';
  const hasModifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!hasModifier || event.altKey || event.shiftKey) {
    return undefined;
  }
  return FRAME_SHORTCUTS.get(event.code);
};

export const useDemoKeys = ({
  onPrevious,
  onNext,
  onReplay,
  onPreviousStep,
  onNextStep,
  onShowHint,
  onFrameShortcut,
}: Params) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      const shortcut = frameShortcutOf({ event });
      if (shortcut !== undefined) {
        event.preventDefault();
        onFrameShortcut({ code: shortcut });
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onPreviousStep();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onNextStep();
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        onShowHint();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        onReplay();
      }
    },
    [onPrevious, onNext, onReplay, onPreviousStep, onNextStep, onShowHint, onFrameShortcut],
  );
