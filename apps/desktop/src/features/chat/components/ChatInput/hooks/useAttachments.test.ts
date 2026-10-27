import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextAgentId } from '@goodboy/types/testing';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { PendingAttachment } from '../../../../attachments/pendingAttachment';

const writeAttachmentSpy = vi.hoisted(() => vi.fn(async () => 'attachments/a.png'));
const readAttachmentSpy = vi.hoisted(() => vi.fn(async () => 'data:image/png;base64,QUJD'));
const deleteAttachmentSpy = vi.hoisted(() => vi.fn(async () => undefined));

type PendingAttachmentsArgs = {
  readonly enabled: boolean;
  readonly persistToDisk: (att: {
    readonly id: string;
    readonly fileName: string;
    readonly blob: Blob;
  }) => Promise<string | null>;
};

const lastPendingArgs = vi.hoisted(() => ({ current: null as PendingAttachmentsArgs | null }));

vi.mock('../../../turn', () => ({
  writeAttachment: writeAttachmentSpy,
  readAttachment: readAttachmentSpy,
  deleteAttachment: deleteAttachmentSpy,
}));

vi.mock('../../../../../shared/hooks/usePendingAttachments', () => ({
  usePendingAttachments: (args: PendingAttachmentsArgs) => {
    lastPendingArgs.current = args;
    const [attachments, setAttachments] = useState<ReadonlyArray<PendingAttachment>>([]);
    const composerRef = useRef(null);
    const fileInputRef = useRef(null);
    return {
      attachments,
      setAttachments,
      isDragging: false,
      composerRef,
      fileInputRef,
      onPaste: () => undefined,
      onFileInputChange: () => undefined,
      removeAttachment: () => undefined,
    };
  },
}));

const { useAttachments } = await import('./useAttachments');

const SESSION_ID = 'session-1' as SessionId;
const AGENT_A = 'agent-a' as AgentId;
const AGENT_B = nextAgentId();
const showToast = vi.fn();

const draft = {
  id: 'att-1',
  fileName: 'a.png',
  mimeType: 'image/png',
  relPath: 'attachments/a.png',
};

type MountParams = {
  readonly worktree: string | null;
  readonly providerDisconnected?: boolean;
};

const mount = ({ worktree, providerDisconnected = false }: MountParams) =>
  renderHook(
    ({ selectedAgentId }: { readonly selectedAgentId: AgentId | null }) =>
      useAttachments({
        selectedAgentId,
        sessionWorktree: worktree,
        providerDisconnected,
        showToast,
      }),
    { initialProps: { selectedAgentId: null as AgentId | null } },
  );

beforeEach(() => {
  writeAttachmentSpy.mockClear();
  readAttachmentSpy.mockClear();
  deleteAttachmentSpy.mockClear();
  lastPendingArgs.current = null;
  useAppStore.setState({
    agentAttachments: {},
    selectedAgentId: {},
    setAgentAttachments: vi.fn(),
    clearAgentAttachments: vi.fn(),
  } as never);
});

describe('useAttachments', () => {
  it('disables the composer picker when the provider is disconnected', () => {
    mount({ worktree: '/tmp/wt', providerDisconnected: true });
    expect(lastPendingArgs.current?.enabled).toBe(false);
  });

  it('refuses to persist to disk without a worktree', async () => {
    mount({ worktree: null });
    const persisted = await lastPendingArgs.current?.persistToDisk({
      id: 'att-1',
      fileName: 'a.png',
      blob: new Blob(['ABC'], { type: 'image/png' }),
    });
    expect(persisted).toBeNull();
    expect(writeAttachmentSpy).not.toHaveBeenCalled();
  });

  it('writes the decoded attachment into the worktree', async () => {
    mount({ worktree: '/tmp/wt' });
    const persisted = await lastPendingArgs.current?.persistToDisk({
      id: 'att-1',
      fileName: 'a.png',
      blob: new Blob(['ABC'], { type: 'image/png' }),
    });
    expect(persisted).toBe('attachments/a.png');
    expect(writeAttachmentSpy).toHaveBeenCalledWith({
      worktreeDir: '/tmp/wt',
      attachmentId: 'att-1',
      fileName: 'a.png',
      dataBase64: 'QUJD',
    });
  });

  it('returns null when the write fails', async () => {
    writeAttachmentSpy.mockRejectedValueOnce(new Error('disk full'));
    mount({ worktree: '/tmp/wt' });
    const persisted = await lastPendingArgs.current?.persistToDisk({
      id: 'att-1',
      fileName: 'a.png',
      blob: new Blob(['ABC'], { type: 'image/png' }),
    });
    expect(persisted).toBeNull();
  });

  it('restores the stored draft when an agent is selected', async () => {
    useAppStore.setState({ agentAttachments: { [AGENT_A]: [draft] } } as never);
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(result.current.attachments.map((a) => a.id)).toEqual(['att-1']);
    });
    expect(readAttachmentSpy).toHaveBeenCalledWith('/tmp/wt', 'attachments/a.png');
  });

  it('drops the restored draft when the attachment cannot be read', async () => {
    readAttachmentSpy.mockRejectedValueOnce(new Error('missing'));
    useAppStore.setState({ agentAttachments: { [AGENT_A]: [draft] } } as never);
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(readAttachmentSpy).toHaveBeenCalled();
    });
    expect(result.current.attachments).toEqual([]);
  });

  it('clears the composer when no agent is selected', async () => {
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(readAttachmentSpy).not.toHaveBeenCalled();
    });
    rerender({ selectedAgentId: null });
    expect(result.current.attachments).toEqual([]);
  });

  it('deletes the sent files and clears the draft for the sending agent', async () => {
    const clearAgentAttachments = vi.fn();
    useAppStore.setState({
      selectedAgentId: { [SESSION_ID]: AGENT_A },
      clearAgentAttachments,
    } as never);
    const { result } = mount({ worktree: '/tmp/wt' });
    act(() => {
      result.current.cleanupSentAttachments({
        agentId: AGENT_A,
        atts: [
          { ...draft, blob: new Blob(['ABC']) },
          { ...draft, id: 'att-2', relPath: null, blob: new Blob(['ABC']) },
        ],
      });
    });
    expect(deleteAttachmentSpy).toHaveBeenCalledTimes(1);
    expect(deleteAttachmentSpy).toHaveBeenCalledWith('/tmp/wt', 'attachments/a.png');
    expect(clearAgentAttachments).toHaveBeenCalledWith(AGENT_A);
  });

  it('is not ready until the stored draft has been restored for the selected agent', async () => {
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    expect(result.current.isRestored).toBe(false);
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });
    rerender({ selectedAgentId: null });
    expect(result.current.isRestored).toBe(false);
  });

  it('adds an output handoff as a text file saved in the worktree', async () => {
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });
    let isApplied = false;
    await act(async () => {
      isApplied = await result.current.attachOutputHandoffs({
        agentId: AGENT_A,
        handoffs: [
          {
            id: 'handoff-1',
            title: 'Output of Check posting drift, Exit 1',
            fileName: 'Output of Check posting drift, Exit 1.txt',
            text: 'Output of Check posting drift, Exit 1\n\nFAIL postings\n',
            isTruncated: false,
          },
        ],
      });
    });
    expect(isApplied).toBe(true);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0]?.fileName).toBe(
      'Output of Check posting drift, Exit 1.txt',
    );
    expect(result.current.attachments[0]?.mimeType).toBe('text/plain');
    expect(await result.current.attachments[0]?.blob.text()).toContain('FAIL postings');
    expect(writeAttachmentSpy).toHaveBeenCalledTimes(1);
  });

  it('drops a handoff that finishes after the composer moved to another agent', async () => {
    const { result, rerender } = mount({ worktree: '/tmp/wt' });
    rerender({ selectedAgentId: AGENT_A });
    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });
    let isApplied = true;
    await act(async () => {
      isApplied = await result.current.attachOutputHandoffs({
        agentId: AGENT_B,
        handoffs: [
          {
            id: 'handoff-1',
            title: 'Output of x',
            fileName: 'Output of x.txt',
            text: 'x',
            isTruncated: false,
          },
        ],
      });
    });
    expect(isApplied).toBe(false);
    expect(result.current.attachments).toEqual([]);
  });
});
