import { ClampedText } from '../../../../shared/components/ClampedText';

type Props = {
  readonly text: string;
};

export const HandoffRawText = ({ text }: Props) => (
  <ClampedText
    text={text}
    className="whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-muted-foreground"
  >
    {text}
  </ClampedText>
);
