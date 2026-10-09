import { Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useChatOrigins } from '../hooks/useChatOrigins';
import { CONCEPT_ICONS, ICON_SIZE } from './conceptIcons';

type Props = {
  readonly sessionId: SessionId;
};

const KIND_LABEL = {
  new: 'From chat',
  add: 'Fed by chat',
} as const;

export const ChatOriginGlyph = ({ sessionId }: Props) => {
  const origins = useChatOrigins({ sessionId });
  if (origins.length === 0) {
    return null;
  }
  return (
    <span className="flex shrink-0 items-center gap-1 self-center text-faint-foreground">
      {origins.map((origin) => {
        const label = `${KIND_LABEL[origin.kind]} · ${origin.title}`;
        return (
          <Tooltip key={origin.chatId} content={label} anchorClassName="flex">
            <span role="img" aria-label={label} className="flex">
              <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden />
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
};
