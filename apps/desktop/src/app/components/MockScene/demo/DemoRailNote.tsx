type Props = {
  readonly isEveryGroupTried: boolean;
};

export const DemoRailNote = ({ isEveryGroupTried }: Props) => (
  <p aria-live="polite" className="px-3 text-label text-muted-foreground">
    {isEveryGroupTried
      ? 'You have tried every group. Take Goodboy home.'
      : 'The real Goodboy on sample projects. Run it on your own code.'}
  </p>
);
