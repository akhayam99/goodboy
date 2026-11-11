import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';

type Params = {
  readonly model: BrowserPaneModel;
};

type TextParams = {
  readonly text: string;
};

type FocusParams = {
  readonly isFocused: boolean;
};

type HighlightParams = {
  readonly index: number;
};

type ActiveParams = {
  readonly id: string | null;
};

type RunParams = {
  readonly isAlternate: boolean;
};

export type CommandKeys = (event: KeyboardEvent<HTMLInputElement>) => void;

export type CommandRun = (params: RunParams) => void;

export type CommandField = {
  readonly fieldRef: RefObject<HTMLInputElement | null>;
  readonly keysRef: RefObject<CommandKeys | null>;
  readonly runRef: RefObject<CommandRun | null>;
  readonly submit: () => Promise<void>;
  readonly value: string;
  readonly query: string;
  readonly isFieldShown: boolean;
  readonly isOpen: boolean;
  readonly listId: string;
  readonly highlight: number;
  readonly activeId: string | null;
  readonly setHighlight: (params: HighlightParams) => void;
  readonly setActiveId: (params: ActiveParams) => void;
  readonly edit: () => void;
  readonly type: (params: TextParams) => void;
  readonly setFocused: (params: FocusParams) => void;
  readonly leave: () => void;
  readonly close: () => void;
};

export const useCommandField = ({ model }: Params): CommandField => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listId = useId();
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const keysRef = useRef<CommandKeys | null>(null);
  const runRef = useRef<CommandRun | null>(null);
  const isEmpty = model.shown === null;
  const isFieldShown = isEmpty || isEditing;
  const isOpen = isFieldShown && isFocused;
  const shownId = model.shown?.tab.id ?? null;

  useEffect(() => {
    setDraft(null);
    setIsEditing(false);
  }, [shownId]);

  useEffect(() => {
    if (!isFieldShown) {
      return;
    }
    if (isEmpty) {
      setDraft(null);
    }
    fieldRef.current?.focus({ preventScroll: true });
  }, [isFieldShown, isEmpty, model.isDrafting]);

  const leave = (): void => {
    setDraft(null);
    setIsEditing(false);
    setHighlight(0);
  };

  const showActive = useCallback(({ id }: ActiveParams) => setActiveId(id), []);

  const close = (): void => {
    leave();
    fieldRef.current?.blur();
  };

  useEscapeLayer(close, isOpen || (isEditing && !isEmpty));

  const value = draft ?? model.address;

  return {
    fieldRef,
    keysRef,
    runRef,
    submit: async () => {
      const run = runRef.current;
      if (run !== null) {
        run({ isAlternate: false });
        return;
      }
      const isDone = await model.submit({ text: value });
      if (isDone) {
        close();
      }
    },
    value,
    query: draft ?? '',
    isFieldShown,
    isOpen,
    listId,
    highlight,
    activeId: isOpen ? activeId : null,
    setHighlight: ({ index }) => setHighlight(index),
    setActiveId: showActive,
    edit: () => {
      if (isFieldShown) {
        fieldRef.current?.focus({ preventScroll: true });
        return;
      }
      setIsEditing(true);
    },
    type: ({ text }) => {
      setDraft(text);
      setHighlight(0);
    },
    setFocused: ({ isFocused: isNowFocused }) => {
      setIsFocused(isNowFocused);
      if (!isNowFocused && !isEmpty) {
        leave();
      }
    },
    leave,
    close,
  };
};
