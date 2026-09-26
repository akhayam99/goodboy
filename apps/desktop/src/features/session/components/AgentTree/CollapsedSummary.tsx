type Props = {
  readonly text: string;
};

export const CollapsedSummary = ({ text }: Props) => {
  return <p className="pb-1 pl-2 text-secondary text-faint-foreground">{text}</p>;
};
