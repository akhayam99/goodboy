type Props = {
  readonly goes?: string | undefined;
  readonly stays?: string | undefined;
};

export const ConfirmGoesStays = ({ goes, stays }: Props) => {
  if (goes === undefined && stays === undefined) {
    return null;
  }
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-muted-foreground">
      {goes === undefined ? null : (
        <>
          <dt className="text-eyebrow text-faint-foreground">Goes</dt>
          <dd>{goes}</dd>
        </>
      )}
      {stays === undefined ? null : (
        <>
          <dt className="text-eyebrow text-faint-foreground">Stays</dt>
          <dd>{stays}</dd>
        </>
      )}
    </dl>
  );
};
