import { ClampedProse, Markdown } from '@goodboy/ui';

type Props = {
  readonly body: string;
  readonly isClamped: boolean;
  readonly isCompact?: boolean;
};

const COMPACT_MARKDOWN_CLASS = 'text-body [&_li]:text-body [&_p]:text-body';

export const ThreadBody = ({ body, isClamped, isCompact = false }: Props) => {
  const text = body.trim();

  if (text === '') {
    return <p className="text-body italic text-faint-foreground">(empty)</p>;
  }
  if (isClamped) {
    return (
      <ClampedProse
        text={text}
        lines={3}
        className={isCompact ? COMPACT_MARKDOWN_CLASS : 'text-prose'}
      />
    );
  }
  return <Markdown text={text} className={isCompact ? COMPACT_MARKDOWN_CLASS : 'text-prose'} />;
};
