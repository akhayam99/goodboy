type Params = {
  readonly text: string;
};

const legacyCopy = ({ text }: Params): void => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    if (!document.execCommand('copy')) {
      throw new Error('the clipboard refused the text');
    }
  } finally {
    document.body.removeChild(textarea);
  }
};

export const copyToClipboard = async ({ text }: Params): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    legacyCopy({ text });
  }
};
