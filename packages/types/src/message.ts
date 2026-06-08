import type { AgentId, IsoDateTime, MessageId, SessionId } from './ids';
import type { TurnProviderOverride } from './provider-preference';

export type MessageRole = 'user' | 'assistant' | 'system';

// A file written to disk and referenced by the spawned provider CLI. The CLI
// reads it from `relPath` (resolved against the session worktree, its cwd) to
// see the content — providers have no API content-block channel here. `kind`
// drives rendering only: images get an inline thumbnail, everything else a
// file chip.
export type MessageAttachment = Readonly<{
  id: string;
  kind: 'image' | 'file';
  fileName: string;
  mimeType: string;
  /** Path relative to the session worktree root (the spawned CLI's cwd). */
  relPath: string;
}>;

// Composer → store hand-off: raw file bytes not yet written to disk. The store
// persists them via the `attachment_write` Tauri command, producing a
// `MessageAttachment` with a stable `relPath`.
export type AttachmentInput = Readonly<{
  id: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
}>;

export type Message = Readonly<{
  id: MessageId;
  sessionId: SessionId;
  agentId: AgentId;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
  providerOverride?: TurnProviderOverride;
}>;
