import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useWorkspaceWindowState } from './index';

const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;

beforeEach(() => {
  useAppStore.setState({ currentWorkspaceId: null, windowPresence: {} });
});

describe('useWorkspaceWindowState', () => {
  it('reports current for the workspace open in this window', () => {
    useAppStore.setState({ currentWorkspaceId: WS_A });
    const { result } = renderHook(() => useWorkspaceWindowState({ workspaceId: WS_A }));
    expect(result.current).toBe('current');
  });

  it('reports other-window for a workspace shown in another window', () => {
    useAppStore.setState({ currentWorkspaceId: WS_A, windowPresence: { 'win-1': WS_B } });
    const { result } = renderHook(() => useWorkspaceWindowState({ workspaceId: WS_B }));
    expect(result.current).toBe('other-window');
  });

  it('reports closed for a workspace not open anywhere', () => {
    useAppStore.setState({ currentWorkspaceId: WS_A, windowPresence: {} });
    const { result } = renderHook(() => useWorkspaceWindowState({ workspaceId: WS_B }));
    expect(result.current).toBe('closed');
  });
});
