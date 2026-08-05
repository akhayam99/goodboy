type Props = {
  readonly url: string | null;
  readonly alt: string;
};

export const IssueNoteAvatar = ({ url, alt }: Props) => {
  if (url == null || url === '') {
    return (
      <span
        aria-hidden
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-5 w-5 shrink-0 rounded-full" loading="lazy" />;
};
