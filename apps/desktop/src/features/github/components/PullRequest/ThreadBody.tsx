import { ClampedProse, Markdown } from '@goodboy/ui';

type Props = {
  readonly body: string;
  readonly clamped: boolean;
};

export const ThreadBody = ({ body, clamped }: Props) => {
  const text = body.trim();

  if (text === '') {
    return <p className="text-body italic text-faint-foreground">(empty)</p>;
  }
  if (clamped) {
    return <ClampedProse text={text} lines={3} className="text-prose" />;
  }
  return <Markdown text={text} className="text-prose" />;
};
