import { ClampedProse, Markdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { SessionMediaScope } from '../SessionMediaScope';

type Props = {
  readonly body: string;
  readonly isClamped: boolean;
  readonly isCompact?: boolean;
  readonly sessionId?: SessionId | null;
};

const COMPACT_MARKDOWN_CLASS = 'text-body [&_li]:text-body [&_p]:text-body [&_img]:max-h-80';
const COMMENT_MARKDOWN_CLASS = 'text-prose [&_img]:max-h-80';

export const ThreadBody = ({ body, isClamped, isCompact = false, sessionId = null }: Props) => {
  const text = body.trim();

  if (text === '') {
    return <p className="text-body italic text-faint-foreground">(empty)</p>;
  }
  const className = isCompact ? COMPACT_MARKDOWN_CLASS : COMMENT_MARKDOWN_CLASS;
  if (isClamped) {
    return <ClampedProse text={text} lines={3} className={className} />;
  }
  return (
    <SessionMediaScope sessionId={sessionId}>
      <Markdown text={text} className={className} />
    </SessionMediaScope>
  );
};
