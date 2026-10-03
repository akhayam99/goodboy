import type { RefObject } from 'react';
import { registerShortcut } from './dispatcher';

const ITEM_SELECTOR = '[data-select-id]';

export type SelectionSurface = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly latest: RefObject<SelectionSurfaceHandlers>;
};

type SelectionSurfaceHandlers = {
  readonly hasSelection: boolean;
  readonly onToggle: (id: string) => void;
  readonly onSelectAll: () => void;
  readonly onDelete?: () => void;
};

const surfaces = new Set<SelectionSurface>();
let pointerTarget: Element | null = null;
let unbind: (() => void) | null = null;

const idOf = (node: Element | null): string | null =>
  node?.closest(ITEM_SELECTOR)?.getAttribute('data-select-id') ?? null;

const contains = (surface: SelectionSurface, node: Node | null): boolean =>
  node !== null && surface.containerRef.current?.contains(node) === true;

type Engaged = {
  readonly surface: SelectionSurface;
  readonly focusedId: string | null;
  readonly hoveredId: string | null;
};

const engaged = (): Engaged | null => {
  const active = document.activeElement;
  const found = [...surfaces];
  const focused = found.find((surface) => contains(surface, active));
  const hovered = found.find((surface) => contains(surface, pointerTarget));
  const surface = focused ?? hovered;
  if (surface === undefined) {
    return null;
  }
  return {
    surface,
    focusedId: focused === undefined ? null : idOf(active),
    hoveredId: hovered === surface ? idOf(pointerTarget) : null,
  };
};

const onToggle = (): boolean => {
  const current = engaged();
  const id = current === null ? null : (current.focusedId ?? current.hoveredId);
  if (current === null || id === null) {
    return false;
  }
  current.surface.latest.current?.onToggle(id);
  return true;
};

const onSelectAll = (): boolean => {
  const current = engaged();
  if (current === null) {
    return false;
  }
  current.surface.latest.current?.onSelectAll();
  return true;
};

const onDelete = (): boolean => {
  const handlers = engaged()?.surface.latest.current;
  if (handlers === undefined || !handlers.hasSelection || handlers.onDelete === undefined) {
    return false;
  }
  handlers.onDelete();
  return true;
};

const trackPointer = (event: MouseEvent): void => {
  pointerTarget = event.target instanceof Element ? event.target : null;
};

const bind = (): (() => void) => {
  window.addEventListener('mouseover', trackPointer);
  const drops = [
    registerShortcut('selection.toggle', onToggle, { canDecline: true }),
    registerShortcut('selection.all', onSelectAll, { canDecline: true }),
    registerShortcut('selection.delete', onDelete, { canDecline: true }),
  ];
  return () => {
    window.removeEventListener('mouseover', trackPointer);
    pointerTarget = null;
    for (const drop of drops) {
      drop();
    }
  };
};

export const registerSelectionSurface = (surface: SelectionSurface): (() => void) => {
  surfaces.add(surface);
  unbind ??= bind();
  return () => {
    surfaces.delete(surface);
    if (surfaces.size > 0) {
      return;
    }
    unbind?.();
    unbind = null;
  };
};
