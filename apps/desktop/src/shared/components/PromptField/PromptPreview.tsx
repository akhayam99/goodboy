import { Markdown } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly minHeight: number;
};

export const PromptPreview = ({ text, minHeight }: Props) => (
  <div
    data-testid="prompt-preview"
    className="min-w-0 wrap-anywhere px-3 py-2 text-body text-foreground"
    style={{ minHeight }}
  >
    {text.trim() === '' ? (
      <span className="text-faint-foreground">Nothing to preview</span>
    ) : (
      <Markdown text={text} />
    )}
  </div>
);
