import { InlineMarkdown } from '@goodboy/ui';
import { SummaryCode } from './SummaryCode';

type Props = {
  readonly text: string;
};

export const SummaryText = ({ text }: Props) => <InlineMarkdown text={text} codeAs={SummaryCode} />;
