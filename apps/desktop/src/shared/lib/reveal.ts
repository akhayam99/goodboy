import { invokeCommand } from './invokeCommand';

type RevealInFileManagerParams = {
  readonly path: string;
};

export const revealInFileManager = async ({ path }: RevealInFileManagerParams): Promise<void> => {
  await invokeCommand('reveal_in_file_manager', { path });
};
