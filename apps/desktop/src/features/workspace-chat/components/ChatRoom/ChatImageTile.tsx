import { ImageIcon, ImageOff } from 'lucide-react';
import type { ChatMessageAttachment } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useChatImageUrl } from '../../hooks/useChatImageUrl';

type Props = {
  readonly attachment: ChatMessageAttachment;
};

export const ChatImageTile = ({ attachment }: Props) => {
  const image = useChatImageUrl({ chatId: attachment.chatId, attachmentId: attachment.id });
  return (
    <figure
      data-chat-image={attachment.id}
      className="flex w-32 min-w-0 flex-col overflow-hidden rounded-md bg-background ring-1 ring-inset ring-border-soft"
    >
      <div className="grid h-16 place-items-center overflow-hidden bg-elevated text-faint-foreground">
        {image.status === 'ready' ? (
          <img src={image.url} alt={attachment.fileName} className="size-full object-cover" />
        ) : image.status === 'missing' ? (
          <ImageOff size={ICON_SIZE.control} aria-label="Image no longer on this computer" />
        ) : (
          <ImageIcon size={ICON_SIZE.control} aria-hidden />
        )}
      </div>
      <figcaption className="truncate px-2 py-0.5 text-meta text-muted-foreground">
        {attachment.fileName}
      </figcaption>
    </figure>
  );
};
