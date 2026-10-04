type Props = {
  readonly dragNote: string | null;
};

export const PolicyHint = ({ dragNote }: Props) => {
  if (dragNote !== null) {
    return <p className="min-w-0 flex-1 text-meta text-foreground">{dragNote}</p>;
  }
  return <p className="min-w-0 flex-1 text-meta text-faint-foreground">First On is the default.</p>;
};
