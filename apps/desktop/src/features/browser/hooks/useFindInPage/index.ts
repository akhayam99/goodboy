import { useEffect, useRef, useState, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
};

type TextParams = {
  readonly text: string;
};

type SearchParams = {
  readonly text: string;
  readonly isBackwards: boolean;
  readonly isFresh: boolean;
};

type WalkParams = {
  readonly isBackwards: boolean;
};

export type FindOutcome = 'idle' | 'found' | 'missing' | 'failed';

export type FindInPage = {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly isOpen: boolean;
  readonly text: string;
  readonly outcome: FindOutcome;
  readonly open: () => void;
  readonly type: (params: TextParams) => void;
  readonly walk: (params: WalkParams) => void;
  readonly close: () => void;
};

export const useFindInPage = ({ model }: Params): FindInPage => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<FindOutcome>('idle');
  const [focusStep, setFocusStep] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestRef = useRef(0);
  const shownId = model.shown?.tab.id ?? null;

  useEffect(() => {
    latestRef.current += 1;
    setOutcome('idle');
  }, [shownId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, [isOpen, focusStep]);

  const search = async ({ text: needle, isBackwards, isFresh }: SearchParams): Promise<void> => {
    latestRef.current += 1;
    const request = latestRef.current;
    try {
      if (isFresh) {
        await model.clearFind();
      }
      const isFound = await model.find({ text: needle, isBackwards });
      if (request === latestRef.current) {
        setOutcome(isFound ? 'found' : 'missing');
      }
    } catch {
      if (request === latestRef.current) {
        setOutcome('failed');
      }
    }
  };

  const close = (): void => {
    latestRef.current += 1;
    setIsOpen(false);
    setText('');
    setOutcome('idle');
    model.clearFind().catch((failure: unknown) => model.showError({ error: failure }));
  };

  useEscapeLayer(close, isOpen);

  return {
    inputRef,
    isOpen,
    text,
    outcome,
    open: () => {
      setIsOpen(true);
      setFocusStep((step) => step + 1);
    },
    type: ({ text: next }) => {
      setText(next);
      if (next === '') {
        latestRef.current += 1;
        setOutcome('idle');
        model.clearFind().catch((failure: unknown) => model.showError({ error: failure }));
        return;
      }
      void search({ text: next, isBackwards: false, isFresh: true });
    },
    walk: ({ isBackwards }) => {
      if (text === '') {
        return;
      }
      void search({ text, isBackwards, isFresh: false });
    },
    close,
  };
};
