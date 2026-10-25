import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { WORKSPACE_ID as HARBORLINE_ID } from '../../../app/components/MockScene/scenes/BoardScene';
import { type Row, WAIT, clickButton, settle, useAppStore } from './harness';
import {
  HARBORLINE_GOAL,
  HARBORLINE_PROJECT_ID,
  NORTHWIND_GOAL,
  NORTHWIND_ID,
} from './workspace-switch.fixtures';

const onWorkspace = async (id: string): Promise<void> => {
  await waitFor(() => expect(useAppStore.getState().currentWorkspaceId).toBe(id), WAIT);
  await settle();
};

const switchTo = async (name: string): Promise<void> => {
  await clickButton(/^Switch workspace/);
  await clickButton(`Switch to ${name}`);
  await settle(6);
};

const expectNoTitleOf = ({ goals }: { readonly goals: ReadonlyArray<string> }): void => {
  const text = document.body.textContent ?? '';
  expect(goals.filter((goal) => text.includes(goal))).toEqual([]);
};

const goalsOnScreen = (): ReadonlyArray<string> =>
  useAppStore.getState().sessions.map((session) => session.goal);

let harborlineGoals: ReadonlyArray<string> = [];

export const WORKSPACE_SWITCH_ROWS: ReadonlyArray<Row> = [
  {
    name: 'workspace switch: Northwind is listed and replaces every Harborline title',
    covers: ['workspace-switch:list', 'workspace-switch:replace'],
    seed: 'switch-idle',
    open: async () => {
      harborlineGoals = goalsOnScreen();
      expect(harborlineGoals.length).toBeGreaterThan(1);
      await switchTo('Northwind');
    },
    lands: async () => {
      await onWorkspace(NORTHWIND_ID);
      expect(await screen.findAllByText(NORTHWIND_GOAL, undefined, WAIT)).not.toEqual([]);
      expect(goalsOnScreen()).toEqual([NORTHWIND_GOAL]);
      expectNoTitleOf({ goals: harborlineGoals });
    },
  },
  {
    name: 'workspace switch: the Harborline filter is back after a round trip',
    covers: ['workspace-switch:filter-restored'],
    seed: 'switch-idle',
    open: async () => {
      useAppStore.getState().setSelectedProjectIds({
        workspaceId: HARBORLINE_ID,
        selectedProjectIds: [HARBORLINE_PROJECT_ID],
      });
      await switchTo('Northwind');
      await onWorkspace(NORTHWIND_ID);
      expect(useAppStore.getState().getSelectedProjectIds({ workspaceId: NORTHWIND_ID })).toEqual(
        [],
      );
      await switchTo('Harborline');
    },
    lands: async () => {
      await onWorkspace(HARBORLINE_ID);
      expect(useAppStore.getState().getSelectedProjectIds({ workspaceId: HARBORLINE_ID })).toEqual([
        HARBORLINE_PROJECT_ID,
      ]);
      expect(await screen.findAllByText(HARBORLINE_GOAL, undefined, WAIT)).not.toEqual([]);
    },
  },
  {
    name: 'workspace switch: a live agent asks first and Cancel keeps Harborline running',
    covers: ['workspace-switch:confirm', 'workspace-switch:cancel'],
    seed: 'switch',
    open: async () => {
      await switchTo('Northwind');
      const confirm = await screen.findByRole('group', { name: /active in Harborline/ }, WAIT);
      expect(confirm.textContent).toMatch(/Stop them and open here/);
      expect(useAppStore.getState().currentWorkspaceId).toBe(HARBORLINE_ID);
      await clickButton(/^Cancel$/);
    },
    lands: async () => {
      expect(screen.queryByRole('group', { name: /active in Harborline/ })).toBeNull();
      expect(useAppStore.getState().currentWorkspaceId).toBe(HARBORLINE_ID);
      expect(
        useAppStore.getState().sessions.some((session) => session.state.kind === 'running'),
      ).toBe(true);
      expect(screen.queryByText(NORTHWIND_GOAL)).toBeNull();
    },
  },
];
