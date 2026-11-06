import { useAppStore } from '../../store';
import { isOverlayOpen } from '../../shared/keyboard/isOverlayOpen';
import { isTextEntryTarget } from '../../shared/keyboard/isTypingTarget';
import { selectOpenDrawer } from '../../store/slices/drawer/selectOpenDrawer';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { parentPlace } from '../../store/slices/navigation/parentPlace';

type FieldParams = {
  readonly element: HTMLElement;
};

const VALUE_ONLY_INPUTS: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

const hasText = ({ element }: FieldParams): boolean => {
  if (element instanceof HTMLInputElement && VALUE_ONLY_INPUTS.has(element.type)) {
    return false;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.trim() !== '';
  }
  return (element.textContent ?? '').trim() !== '';
};

type Params = Record<never, never>;

export const escapeLadder = ({}: Params): void => {
  if (isOverlayOpen({})) {
    return;
  }
  const focused = document.activeElement;
  if (
    focused instanceof HTMLElement &&
    isTextEntryTarget(focused) &&
    hasText({ element: focused })
  ) {
    focused.blur();
    return;
  }
  const state = useAppStore.getState();
  if (selectOpenDrawer(state) !== null) {
    state.closeDrawer();
    return;
  }
  const live = captureLocation({ state });
  if (live.studio !== null || live.place.at !== 'session') {
    return;
  }
  if (parentPlace({ state, place: live.place }) === null) {
    return;
  }
  state.up();
};
