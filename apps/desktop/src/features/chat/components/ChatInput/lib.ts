import type {
  AttachmentInput,
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  TurnProviderOverride,
} from '@goodboy/types';
import { EFFORT_LEVELS, type EffortLevel } from '../../utils/chat-constants';
import type { ToastKind } from '../../../../app/components/Toast';

export const RUNNING_KINDS = new Set(['starting', 'running']);

export const CHAT_PREFIX_RE = /^\s*[$/~@][^\s]*$/;

export const CHAT_PLACEHOLDER = 'Message Claude · $ scripts · ~ workflows · @ agents';

export const VALID_PROVIDERS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
];

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
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly override: TurnProviderOverride | undefined;
};

export function extFromMime(mimeType: string): string {
  const slash = mimeType.indexOf('/');
  const ext = slash >= 0 ? mimeType.slice(slash + 1) : '';
  return ext.length > 0 && ext.length <= 5 ? ext : 'png';
}

export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function readFileAsDataUrl(file: File): Promise<string> {
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
}

export function toAttachmentInput(a: PendingAttachment): AttachmentInput {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    dataBase64: dataUrlToBase64(a.dataUrl),
  };
}

export function asEffortLevel(v: string | undefined | null): EffortLevel | null {
  return v && EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : null;
}

export function asProvider(v: string | undefined | null): ProviderId | null {
  return v && VALID_PROVIDERS.includes(v as ProviderId) ? (v as ProviderId) : null;
}

export function toastKindForAlert(kind: BudgetAlertKind): ToastKind {
  return kind === 'provider-exceeded' || kind === 'session-exceeded' ? 'error' : 'warning';
}

export function toastMessageForAlert(alert: BudgetAlert): string {
  const pct = alert.capUsd > 0 ? Math.round((alert.currentUsd / alert.capUsd) * 100) : 0;
  if (alert.kind === 'provider-threshold') {
    return `provider ${alert.provider ?? '?'} budget at ${pct}%`;
  }
  if (alert.kind === 'provider-exceeded') {
    return `provider ${alert.provider ?? '?'} budget exceeded`;
  }
  if (alert.kind === 'session-threshold') {
    return `session budget at ${pct}%`;
  }
  return 'session budget exceeded';
}
