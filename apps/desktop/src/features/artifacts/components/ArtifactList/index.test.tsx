// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, picker } = vi.hoisted(() => ({
  state: {
    openArtifactCreation: vi.fn(),
    importWireframe: vi.fn(async (_params: Record<string, unknown>) => ({ id: 'wireframe-9' })),
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    workspaces: [] as ReadonlyArray<Record<string, unknown>>,
  },
  picker: { next: null as unknown },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../wireframes/readWireframeFile', () => ({
  pickWireframeFile: vi.fn(async () => picker.next),
  readWireframeFile: vi.fn(async () => picker.next),
}));

import { ArtifactList } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const renderList = (onImported = vi.fn()) => {
  render(
    <ArtifactList
      sessionId={SESSION_ID}
      rows={[]}
      counts={{ all: 0, plan: 0, report: 0, wireframe: 0 }}
      filter="all"
      onFilterChange={vi.fn()}
      onOpen={vi.fn()}
      onImported={onImported}
    />,
  );
  return onImported;
};

describe('ArtifactList states', () => {
  it('says what will be here and offers one primary the first time', async () => {
    renderList();

    expect(screen.getByRole('heading', { level: 2, name: 'No artifacts yet' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'New artifact' }));

    expect(await screen.findByRole('menu', { name: 'New artifact' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Report/ })).toBeDefined();
  });

  it('names the filter and clears it when the filter matches nothing', () => {
    const onFilterChange = vi.fn();
    render(
      <ArtifactList
        sessionId={SESSION_ID}
        rows={[]}
        counts={{ all: 3, plan: 0, report: 2, wireframe: 1 }}
        filter="plan"
        onFilterChange={onFilterChange}
        onOpen={vi.fn()}
        onImported={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'No artifacts yet' })).toBeNull();
    expect(screen.getByText('No plans in this session.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(onFilterChange).toHaveBeenCalledWith('all');
  });
});

const openImport = () => {
  fireEvent.click(screen.getByTestId('artifact-new'));
  fireEvent.click(screen.getByRole('menuitem', { name: /Import wireframe JSON/ }));
};

beforeEach(() => {
  state.importWireframe.mockClear();
  picker.next = null;
});
afterEach(cleanup);

describe('ArtifactList wireframe import', () => {
  it('says what the validator adjusted and imports on Import anyway', async () => {
    picker.next = {
      status: 'ready',
      fileName: 'cascadia-onboarding.json',
      title: 'Cascadia onboarding',
      sourceText: '{"version":2}',
      fidelity: 'low',
      screenCount: 4,
      device: 'phone',
      version: 2,
      adjustments: ['screens[0].root.width is not part of the wireframe contract'],
    };
    const onImported = renderList();
    openImport();
    await waitFor(() =>
      expect(
        screen.getByText('Cascadia onboarding can be imported with 1 adjustment.'),
      ).toBeDefined(),
    );
    expect(screen.getByTestId('wireframe-import-preview').textContent).toContain(
      '4 screens · phone · version 2',
    );
    fireEvent.click(screen.getByTestId('wireframe-import-confirm'));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('wireframe-9'));
    expect(state.importWireframe).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cascadia onboarding', sourceText: '{"version":2}' }),
    );
    expect(screen.queryByTestId('wireframe-import-preview')).toBeNull();
  });

  it('refuses a file it cannot read and imports nothing', async () => {
    picker.next = {
      status: 'invalid',
      fileName: 'notes.json',
      issues: [{ path: 'screens', message: 'expected at least one screen' }],
    };
    renderList();
    openImport();
    await waitFor(() =>
      expect(screen.getByText('notes.json is not a wireframe Goodboy can read.')).toBeDefined(),
    );
    expect(screen.getByTestId('wireframe-import-issues').textContent).toContain(
      'screens: expected at least one screen',
    );
    expect(state.importWireframe).not.toHaveBeenCalled();
  });
});
