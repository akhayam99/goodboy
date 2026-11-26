import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MessageAttachment,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { readAttachment, writeAttachment } from '../../../../features/chat/turn';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly refs: ReadonlyArray<MessageAttachment>;
  readonly workingDir: string;
  readonly activeAgentId: AgentId;
  readonly sessionId: SessionId;
  readonly now: () => IsoDateTime;
};

type Result =
  | { readonly isReadable: true; readonly refs: ReadonlyArray<MessageAttachment> }
  | { readonly isReadable: false };

export const readableAttachmentRefs = async ({
  get,
  refs,
  workingDir,
  activeAgentId,
  sessionId,
  now,
}: Params): Promise<Result> => {
  try {
    const readable = await Promise.all(
      refs.map(async (ref): Promise<MessageAttachment> => {
        if (ref.dir === undefined || ref.dir === workingDir) {
          return ref;
        }
        const dataBase64 = await readAttachment(ref.dir, ref.relPath);
        const relPath = await writeAttachment({
          worktreeDir: workingDir,
          attachmentId: ref.id,
          fileName: ref.fileName,
          dataBase64,
        });
        return {
          id: ref.id,
          kind: ref.kind,
          fileName: ref.fileName,
          mimeType: ref.mimeType,
          relPath,
        };
      }),
    );
    return { isReadable: true, refs: readable };
  } catch (err) {
    get().appendTurnEvent(activeAgentId, sessionId, {
      kind: 'error',
      runId: brandId<ProviderRunId>({ value: crypto.randomUUID() }),
      message: `failed to make the attachment readable for the agent: ${formatError(err)}`,
      at: now(),
    });
    return { isReadable: false };
  }
};
