type Props = {
  readonly isEveryGroupTried: boolean;
};

export const DemoRailNote = ({ isEveryGroupTried }: Props) => (
  <p aria-live="polite" className="px-7 text-meta text-muted-foreground">
    {isEveryGroupTried
      ? 'You have tried every group. Download is top right.'
      : 'Everything here is mock data, and nothing you do leaves this page.'}
  </p>
);
