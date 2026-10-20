type Props = {
  readonly text: string;
};

export const FactCardFootnote = ({ text }: Props) => (
  <span className="min-w-0 text-meta text-faint-foreground">{text}</span>
);
