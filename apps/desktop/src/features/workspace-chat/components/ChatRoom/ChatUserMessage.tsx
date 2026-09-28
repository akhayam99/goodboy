type Props = {
  readonly content: string;
};

export const ChatUserMessage = ({ content }: Props) => (
  <div
    data-chat-message="user"
    className="max-w-[80%] self-end whitespace-pre-wrap rounded-lg bg-subtle px-3 py-2 text-prose text-foreground"
  >
    {content}
  </div>
);
