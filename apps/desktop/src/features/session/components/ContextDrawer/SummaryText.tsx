import { InlineMarkdown } from '@goodboy/ui';
import { codeSpansOf } from './codeSpansOf';
import { SummaryCode } from './SummaryCode';

type Props = {
  readonly text: string;
};

export const SummaryText = ({ text }: Props) => (
  <>
    {codeSpansOf({ text }).map((part, index) =>
      part.kind === 'code' ? (
        <SummaryCode key={`${index}-${part.value}`} value={part.value} />
      ) : (
        <InlineMarkdown key={`${index}-${part.value}`} text={part.value} />
      ),
    )}
  </>
);
