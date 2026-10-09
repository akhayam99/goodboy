import { EmptyLine, Markdown } from '@goodboy/ui';

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
      <EmptyLine className="text-faint-foreground">Nothing to preview</EmptyLine>
    ) : (
      <Markdown text={text} />
    )}
  </div>
);
