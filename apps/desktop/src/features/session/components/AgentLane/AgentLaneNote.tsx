type Props = {
  readonly text: string;
};

export const AgentLaneNote = ({ text }: Props) => (
  <p className="px-1 py-3 text-label text-faint-foreground">{text}</p>
);
