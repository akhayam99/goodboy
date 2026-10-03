import { Markdown } from '@goodboy/ui';

type Props = {
  readonly content: string;
};

export const ChatUserMessage = ({ content }: Props) => (
  <div
    data-chat-message="user"
    className="min-w-0 max-w-[80%] self-end wrap-anywhere rounded-lg bg-subtle px-3 py-2 text-prose text-foreground"
  >
    <Markdown text={content} />
  </div>
);
