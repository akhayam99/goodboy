import { ClampedProse, Markdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { SessionMediaScope } from '../SessionMediaScope';

type Props = {
  readonly body: string;
  readonly isClamped?: boolean;
  readonly sessionId?: SessionId | null;
};

const COMMENT_BODY_CLASS =
  'text-comment text-foreground [&_li]:text-comment [&_p]:text-comment [&_img]:max-h-80';

export const CommentBody = ({ body, isClamped = false, sessionId = null }: Props) => {
  const text = body.trim();

  if (text === '') {
    return <p className="text-comment italic text-faint-foreground">(empty)</p>;
  }
  if (isClamped) {
    return <ClampedProse text={text} lines={3} className={COMMENT_BODY_CLASS} />;
  }
  return (
    <SessionMediaScope sessionId={sessionId}>
      <Markdown text={text} className={COMMENT_BODY_CLASS} />
    </SessionMediaScope>
  );
};
