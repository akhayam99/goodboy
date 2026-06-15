import type {
  AgentId,
  AttachmentInput,
  IsoDateTime,
  MessageAttachment,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { writeAttachment } from '../../../features/chat/turn';
import { attachmentKindFor } from '../../../features/chat/attachment-kinds';
import { formatError } from '../../../shared/lib/errors';
import { buildAttachmentPromptBlock } from '../../turn-helpers';
import type { GetFn } from './types';

type Params = {
  attachmentInputs: ReadonlyArray<AttachmentInput>;
  workingDir: string;
  activeAgentId: AgentId;
  sessionId: SessionId;
  resolvedPrompt: string;
  now: () => IsoDateTime;
};

export const persistAttachments = async (
  get: GetFn,
  { attachmentInputs, workingDir, activeAgentId, sessionId, resolvedPrompt, now }: Params,
): Promise<
  | { ok: true; attachmentRefs: ReadonlyArray<MessageAttachment>; resolvedPrompt: string }
  | { ok: false }
> => {
  let attachmentRefs: ReadonlyArray<MessageAttachment> = [];
  if (attachmentInputs.length > 0) {
    try {
      attachmentRefs = await Promise.all(
        attachmentInputs.map(async (a): Promise<MessageAttachment> => {
          const relPath = await writeAttachment({
            worktreeDir: workingDir,
            attachmentId: a.id,
            fileName: a.fileName,
            dataBase64: a.dataBase64,
          });
          return {
            id: a.id,
            kind: attachmentKindFor(a.mimeType),
            fileName: a.fileName,
            mimeType: a.mimeType,
            relPath,
          };
        }),
      );
    } catch (err) {
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: crypto.randomUUID() as ProviderRunId,
        message: `failed to save attachment: ${formatError(err)}`,
        at: now(),
      });
      return { ok: false };
    }
    return {
      ok: true,
      attachmentRefs,
      resolvedPrompt: `${resolvedPrompt}\n\n${buildAttachmentPromptBlock(attachmentRefs)}`,
    };
  }
  return { ok: true, attachmentRefs, resolvedPrompt };
};
