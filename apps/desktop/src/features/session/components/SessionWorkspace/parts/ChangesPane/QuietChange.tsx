import { CHANGE_FRAME } from './changeFrame';

type Props = {
  readonly text: string;
};

export const QuietChange = ({ text }: Props) => (
  <div className={CHANGE_FRAME}>
    <p className="p-6 text-body text-muted-foreground">{text}</p>
  </div>
);
