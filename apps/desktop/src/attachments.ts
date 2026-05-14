import { invoke } from '@tauri-apps/api/core';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_TURN,
  ATTACHMENT_MIME_TYPES,
  type AttachmentMime,
  type AttachmentRef,
} from '@kay-am/types';

interface SaveResult {
  readonly sha256: string;
  readonly sizeBytes: number;
}

interface LoadResult {
  readonly base64Data: string;
}

export interface PendingAttachment extends AttachmentRef {
  // Object URL for preview rendering — revoked on remove or send.
  readonly previewUrl: string;
}

export class AttachmentValidationError extends Error {
  readonly code: 'mime' | 'size' | 'count';
  constructor(code: 'mime' | 'size' | 'count', message: string) {
    super(message);
    this.code = code;
    this.name = 'AttachmentValidationError';
  }
}

function isAttachmentMime(mime: string): mime is AttachmentMime {
  return (ATTACHMENT_MIME_TYPES as ReadonlyArray<string>).includes(mime);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // 32 KiB chunks keep String.fromCharCode call-arg lists below JS engine
  // stack limits while staying fast.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

export async function fileToAttachment(
  file: File | Blob,
  existingCount: number,
): Promise<PendingAttachment> {
  if (existingCount >= ATTACHMENT_MAX_PER_TURN) {
    throw new AttachmentValidationError(
      'count',
      `max ${ATTACHMENT_MAX_PER_TURN} images per message`,
    );
  }
  const mime = file.type;
  if (!isAttachmentMime(mime)) {
    throw new AttachmentValidationError('mime', `unsupported image type: ${mime || 'unknown'}`);
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    const mb = (ATTACHMENT_MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new AttachmentValidationError('size', `image exceeds ${mb} MB limit`);
  }
  const buffer = await file.arrayBuffer();
  const base64Data = arrayBufferToBase64(buffer);
  const result = await invoke<SaveResult>('attachment_save', {
    args: { mime, base64Data },
  });
  const previewBlob = file instanceof Blob ? file : new Blob([buffer], { type: mime });
  return {
    mime,
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
    previewUrl: URL.createObjectURL(previewBlob),
  };
}

export async function loadAttachmentBase64(ref: AttachmentRef): Promise<string> {
  const result = await invoke<LoadResult>('attachment_load', {
    args: { sha256: ref.sha256, mime: ref.mime },
  });
  return result.base64Data;
}

export function revokePendingPreview(att: PendingAttachment): void {
  try {
    URL.revokeObjectURL(att.previewUrl);
  } catch {
    // best-effort
  }
}
