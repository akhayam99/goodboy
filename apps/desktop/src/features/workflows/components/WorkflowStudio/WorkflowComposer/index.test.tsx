// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import type { WorkflowDraft } from '../../../engine';

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: never) => T) => selector({ workspaceOverrides: {} } as never),
}));

import { WorkflowComposer } from './index';

afterEach(cleanup);

const draft: WorkflowDraft = {
  name: 'Ship the fix',
  description: 'A short description',
  goal: '',
  steps: [],
  origin: 'custom',
  isPreset: false,
};

type Params = { readonly connectedProviders?: ReadonlyArray<ProviderId> };

const renderComposer = ({ connectedProviders = [] }: Params = {}) => {
  const onChangeMeta = vi.fn();
  const onAddBlank = vi.fn();
  render(
    <WorkflowComposer
      form={draft}
      workspaceId={'ws-1' as WorkspaceId}
      connectedProviders={connectedProviders}
      library={[]}
      expandedIdx={null}
      saving={false}
      error={null}
      dragging={false}
      dropIndex={null}
      isNew={false}
      generating={false}
      canGenerate={connectedProviders.length > 0}
      onChangeMeta={onChangeMeta}
      onAddBlank={onAddBlank}
      onToggleExpand={vi.fn()}
      onUpdateStep={vi.fn()}
      onRemoveStep={vi.fn()}
      onMoveStep={vi.fn()}
      draggingStepIdx={null}
      onStartDrag={vi.fn()}
      onAddLibraryStep={vi.fn()}
      onStartStepDrag={vi.fn()}
      onSaveDef={vi.fn()}
      onDeleteDef={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      onGenerate={vi.fn()}
      onReset={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return { onChangeMeta, onAddBlank };
};

describe('WorkflowComposer', () => {
  it('permits local editing with zero providers while explaining generation is unavailable', () => {
    const { onChangeMeta, onAddBlank } = renderComposer();

    expect(screen.getByText('No providers connected')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /rewrite with agent/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow name' }), {
      target: { value: 'Ship the fix twice' },
    });
    expect(onChangeMeta).toHaveBeenCalledWith({ name: 'Ship the fix twice' });

    fireEvent.click(screen.getByRole('button', { name: /add blank step/i }));
    expect(onAddBlank).toHaveBeenCalledOnce();
  });

  it('sends the viewer to provider settings from the composer itself', () => {
    const onOpenSettings = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    renderComposer();

    fireEvent.click(screen.getByRole('button', { name: 'Open providers' }));
    window.removeEventListener('goodboy:open-settings', onOpenSettings);

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect((onOpenSettings.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      scope: 'providers',
    });
  });

  it('drops the notice once a provider is connected', () => {
    renderComposer({ connectedProviders: ['anthropic'] });

    expect(screen.queryByText('No providers connected')).toBeNull();
    expect(
      (screen.getByRole('button', { name: /rewrite with agent/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
