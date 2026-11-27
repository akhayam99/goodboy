import { useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { BrowserToolsTab } from '../../types';

type Params = {
  readonly errorCount: number;
};

type ToggleParams = {
  readonly isByKey: boolean;
};

type TabParams = {
  readonly next: BrowserToolsTab;
};

type NodeParams = {
  readonly node: EventTarget | null;
};

type OpeningParams = {
  readonly errorCount: number;
  readonly tab: BrowserToolsTab;
};

type BlurParams = FocusEvent<HTMLElement>;

export type BrowserToolsFocusWatch = {
  readonly onFocus: () => void;
  readonly onBlur: (params: BlurParams) => void;
};

export type BrowserTools = {
  readonly isOpen: boolean;
  readonly tab: BrowserToolsTab;
  readonly errorCount: number;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly dockRef: RefObject<HTMLElement | null>;
  readonly focusWatch: BrowserToolsFocusWatch;
  readonly toggle: (params: ToggleParams) => void;
  readonly setTab: (params: TabParams) => void;
};

const SELECTED_TOOL = '[role="tablist"][aria-label="Tools"] [role="tab"][aria-selected="true"]';

const openingTabOf = ({ errorCount, tab }: OpeningParams): BrowserToolsTab => {
  if (errorCount > 0) {
    return 'errors';
  }
  return tab === 'errors' ? 'console' : tab;
};

export const useBrowserTools = ({ errorCount }: Params): BrowserTools => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setToolsTab] = useState<BrowserToolsTab>('console');
  const [isFocusInTools, setIsFocusInTools] = useState(false);
  const [isFocusWanted, setIsFocusWanted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);

  const isInTools = ({ node }: NodeParams): boolean =>
    node instanceof Node &&
    (buttonRef.current === node || dockRef.current?.contains(node) === true);

  const close = (): void => {
    const isFocusInDock =
      isInTools({ node: document.activeElement }) && buttonRef.current !== document.activeElement;
    setIsOpen(false);
    setIsFocusWanted(false);
    if (!isFocusInDock) {
      return;
    }
    setIsFocusInTools(false);
    buttonRef.current?.focus();
  };

  const toggle = ({ isByKey }: ToggleParams): void => {
    if (isOpen) {
      close();
      return;
    }
    setToolsTab(openingTabOf({ errorCount, tab }));
    setIsOpen(true);
    setIsFocusWanted(isByKey);
  };

  useEffect(() => {
    if (!isOpen || !isFocusWanted) {
      return;
    }
    setIsFocusWanted(false);
    dockRef.current?.querySelector<HTMLElement>(SELECTED_TOOL)?.focus();
  }, [isOpen, isFocusWanted]);

  useEscapeLayer(close, isOpen && isFocusInTools);

  return {
    isOpen,
    tab,
    errorCount,
    buttonRef,
    dockRef,
    focusWatch: {
      onFocus: () => setIsFocusInTools(true),
      onBlur: ({ relatedTarget }: BlurParams) =>
        setIsFocusInTools(isInTools({ node: relatedTarget })),
    },
    toggle,
    setTab: ({ next }) => setToolsTab(next),
  };
};
