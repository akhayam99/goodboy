import { linkedKeyText } from './linkedKeyText';

type Props = {
  readonly identifier: string;
};

export const LinkedKey = ({ identifier }: Props) => (
  <span data-linked-key="" className="w-18 shrink-0 truncate text-code text-muted-foreground">
    {linkedKeyText({ key: identifier })}
  </span>
);
