type Props = {
  readonly text: string;
};

export const AgentLaneNote = ({ text }: Props) => (
  <p className="px-1 py-3 text-xs text-faint-foreground">{text}</p>
);
