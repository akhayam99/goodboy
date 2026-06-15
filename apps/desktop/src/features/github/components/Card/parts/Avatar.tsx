type Props = {
  readonly url: string | null;
  readonly alt: string;
};

export const Avatar = ({ url, alt }: Props) => {
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-4 w-4 shrink-0 rounded-full" loading="lazy" />;
};
