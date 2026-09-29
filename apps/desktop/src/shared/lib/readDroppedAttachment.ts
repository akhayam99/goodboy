import { invokeCommand } from './invokeCommand';

export type DroppedAttachment = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataBase64: string;
};

type Params = {
  readonly absolutePath: string;
};

export const readDroppedAttachment = async ({ absolutePath }: Params): Promise<DroppedAttachment> =>
  invokeCommand<DroppedAttachment>('attachment_read_dropped', { absPath: absolutePath });
