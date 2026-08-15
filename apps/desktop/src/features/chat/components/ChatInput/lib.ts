import type { AgentId, AttachmentInput, ProviderId, TurnProviderOverride } from '@goodboy/types';
import { EFFORT_LEVELS, type EffortLevel } from '../../utils/chat-constants';

export const RUNNING_KINDS = new Set(['starting', 'running']);

export const CHAT_PREFIX_RE = /^\s*[$/~@][^\s]*$/;

export const CHAT_PLACEHOLDER = 'Message Claude · $ scripts · ~ workflows · @ agents';

export const VALID_PROVIDERS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

type Expect<T extends true> = T;
type ValidProvidersAreTotal =
  Exclude<ProviderId, (typeof VALID_PROVIDERS)[number]> extends never ? true : false;
type _ValidProvidersTotalCheck = Expect<ValidProvidersAreTotal>;

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_LIMIT = 10;

export type PendingAttachment = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly relPath: string | null;
};

export type QueuedTurn = {
  readonly id: string;
  readonly agentId: AgentId;
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly override: TurnProviderOverride | undefined;
};

export const extFromMime = (mimeType: string): string => {
  const slash = mimeType.indexOf('/');
  const ext = slash >= 0 ? mimeType.slice(slash + 1) : '';
  return ext.length > 0 && ext.length <= 5 ? ext : 'png';
};

export const dataUrlToBase64 = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('unexpected file reader result'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
};

export const toAttachmentInput = (a: PendingAttachment): AttachmentInput => {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    dataBase64: dataUrlToBase64(a.dataUrl),
  };
};

export const asEffortLevel = (v: string | undefined | null): EffortLevel | null => {
  return v && EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : null;
};

export const asProvider = (v: string | undefined | null): ProviderId | null => {
  return v && VALID_PROVIDERS.includes(v as ProviderId) ? (v as ProviderId) : null;
};
