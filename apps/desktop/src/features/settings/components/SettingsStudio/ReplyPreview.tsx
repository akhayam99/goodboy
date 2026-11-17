import { Markdown } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly text: string | null;
};

export const ReplyPreview = ({ label, text }: Props) => (
  <section
    aria-label={label}
    aria-live="polite"
    className="flex min-w-0 flex-col gap-1 rounded-md border border-border-soft bg-background px-3 py-2"
  >
    <p className="text-meta text-muted-foreground">{label}</p>
    {text === null ? null : (
      <Markdown text={text} variant="preview" className="text-meta text-foreground" />
    )}
  </section>
);
