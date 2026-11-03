import type { ComponentType } from 'react';
import { AttachmentsScene } from './AttachmentsScene';
import { AttachmentsViewerScene } from './AttachmentsViewerScene';

export const U32_ATTACHMENTS_SCENES = {
  'u32-attachments': AttachmentsScene,
  'u32-attachments-viewer': AttachmentsViewerScene,
} satisfies Readonly<Record<string, ComponentType>>;
