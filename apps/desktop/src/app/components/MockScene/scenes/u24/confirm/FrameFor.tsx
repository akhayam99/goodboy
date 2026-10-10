import { ActivityFrame } from './ActivityFrame';
import { ChatRowsFrame } from './ChatRowsFrame';
import { NoteFrame } from './NoteFrame';
import { NotificationsFrame } from './NotificationsFrame';
import { RichFrame } from './RichFrame';
import { SessionDeleteFrame } from './SessionDeleteFrame';
import type { Variant } from './variants';

type Props = {
  readonly variant: Variant;
};

export const FrameFor = ({ variant }: Props) => {
  switch (variant) {
    case 'notifications':
      return <NotificationsFrame />;
    case 'sessiondelete':
      return <SessionDeleteFrame />;
    case 'chatrow':
      return <ChatRowsFrame />;
    case 'rich':
      return <RichFrame />;
    case 'activity':
      return <ActivityFrame />;
    case 'note':
      return <NoteFrame />;
  }
};
