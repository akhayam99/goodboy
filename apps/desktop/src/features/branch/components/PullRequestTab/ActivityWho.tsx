type Props = {
  readonly name: string | null;
};

export const ActivityWho = ({ name }: Props) => (
  <span className="text-row text-foreground">{name ?? 'Someone'}</span>
);
