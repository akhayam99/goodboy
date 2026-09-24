import { markdownPreview } from '../../../../shared/utils/markdownPreview';

type Params = {
  readonly body: string;
};

export const threadPreview = ({ body }: Params): string => {
  const firstLine = body.split('\n').find((line) => line.trim().length > 0) ?? '';
  return markdownPreview({ text: firstLine });
};
