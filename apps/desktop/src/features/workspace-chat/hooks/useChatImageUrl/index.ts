import { useEffect, useState } from 'react';
import type { ChatAttachmentId, ChatId } from '@goodboy/types';
import { activeChatBackend } from '../../activeChatBackend';

type Params = {
  readonly chatId: ChatId;
  readonly attachmentId: ChatAttachmentId;
};

export type ChatImageUrl =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly url: string }
  | { readonly status: 'missing' };

const LOADING: ChatImageUrl = { status: 'loading' };

export const useChatImageUrl = ({ chatId, attachmentId }: Params): ChatImageUrl => {
  const [image, setImage] = useState<ChatImageUrl>(LOADING);

  useEffect(() => {
    let isLive = true;
    let url: string | null = null;
    setImage(LOADING);
    activeChatBackend
      .readImage({ chatId, attachmentId })
      .then((blob) => {
        if (!isLive) {
          return;
        }
        url = URL.createObjectURL(blob);
        setImage({ status: 'ready', url });
      })
      .catch(() => {
        if (isLive) {
          setImage({ status: 'missing' });
        }
      });
    return () => {
      isLive = false;
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [chatId, attachmentId]);

  return image;
};
