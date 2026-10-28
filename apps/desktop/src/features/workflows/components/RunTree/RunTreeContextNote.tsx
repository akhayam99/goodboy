type Props = {
  readonly answersFor: string | null;
  readonly waveLabel: string | null;
};

const NOTE = 'max-w-40 shrink-0 truncate text-meta text-muted-foreground';

export const RunTreeContextNote = ({ answersFor, waveLabel }: Props) => (
  <>
    {waveLabel === null ? null : (
      <span data-testid="run-tree-wave" className={NOTE}>
        {waveLabel}
      </span>
    )}
    {answersFor === null ? null : <span className={NOTE}>{`answering for ${answersFor}`}</span>}
  </>
);
