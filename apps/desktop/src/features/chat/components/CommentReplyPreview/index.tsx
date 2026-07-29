type Props = {
  readonly body: string;
};

export const CommentReplyPreview = ({ body }: Props) => (
  <span className="flex min-w-0 basis-full items-center gap-1 text-2xs text-muted-foreground">
    <span className="shrink-0 font-medium text-foreground/70">reply</span>
    <span className="truncate" title={body}>
      {body}
    </span>
  </span>
);
