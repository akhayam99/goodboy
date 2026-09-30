import type { ShowToast } from '../../shared/components/Toast';

type Params = {
  readonly text: string;
  readonly showToast: ShowToast;
};

export const copyText = async ({ text, showToast }: Params): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    showToast({
      kind: 'warning',
      title: 'Copy failed',
      message: 'The clipboard refused the text.',
    });
  }
};
