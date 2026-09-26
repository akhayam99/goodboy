import { useSyncExternalStore } from 'react';

let slotNode: HTMLElement | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setConversationSlot = (node: HTMLElement | null): void => {
  if (slotNode === node) {
    return;
  }
  slotNode = node;
  listeners.forEach((listener) => listener());
};

export const useConversationSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    subscribe,
    () => slotNode,
    () => null,
  );
