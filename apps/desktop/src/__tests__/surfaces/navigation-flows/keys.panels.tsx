import { expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { DOCK_FOCUS_DETAIL, DOCK_FOCUS_PAGE } from '@goodboy/ui';
import { panelFocusKeyOf } from '../../../store/slices/drawer/panelFocusKeyOf';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { shellPanelsOf } from '../../../store/slices/drawer/shellPanelsOf';
import { pressShortcut } from '../../helpers/pressKey';
import { settle, useAppStore, WAIT, type Ctx, type Row } from './harness';

const focusedPanel = (): string =>
  panelFocusKeyOf({ panels: shellPanelsOf({ state: useAppStore.getState() }) });

export const PANEL_KEY_ROWS: ReadonlyArray<Row> = [
  {
    name: 'key panel.focusNext steps the focus from the open drawer to the page, panel.focusPrevious steps it back',
    covers: ['key:panel.focusNext', 'key:panel.focusPrevious'],
    open: async ({ sessionId }: Ctx) => {
      useAppStore.getState().openDrawer({
        kind: 'conversation',
        sessionId,
        payload: { threadId: 'thread-harborline' },
      });
      await settle();
      await waitFor(
        () => expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('conversation'),
        WAIT,
      );
      await waitFor(
        () =>
          expect(document.querySelector(`[data-dock-focus="${DOCK_FOCUS_DETAIL}"]`)).not.toBeNull(),
        WAIT,
      );
    },
    lands: async () => {
      expect(focusedPanel()).toBe(DOCK_FOCUS_DETAIL);

      pressShortcut({ id: 'panel.focusNext' });
      await settle();
      await waitFor(() => expect(focusedPanel()).toBe(DOCK_FOCUS_PAGE), WAIT);

      pressShortcut({ id: 'panel.focusPrevious' });
      await settle();
      await waitFor(() => expect(focusedPanel()).toBe(DOCK_FOCUS_DETAIL), WAIT);
    },
  },
];
