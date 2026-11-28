import { TruncatedText } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly value: string;
};

export const FactRow = ({ label, value }: Props) => (
  <li className="flex min-h-8 min-w-0 flex-1 items-center justify-between gap-3">
    <TruncatedText className="text-row text-foreground">{label}</TruncatedText>
    <TruncatedText className="max-w-[60%] text-meta text-muted-foreground tabular-nums">
      {value}
    </TruncatedText>
  </li>
);
