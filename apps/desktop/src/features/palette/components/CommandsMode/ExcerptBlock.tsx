type Props = {
  readonly text: string;
};

export const ExcerptBlock = ({ text }: Props) => (
  <div className="flex gap-3 rounded-md bg-fill p-3">
    <span aria-hidden className="w-0.5 shrink-0 self-stretch rounded-full bg-info" />
    <p className="line-clamp-6 text-label text-foreground">{text}</p>
  </div>
);
