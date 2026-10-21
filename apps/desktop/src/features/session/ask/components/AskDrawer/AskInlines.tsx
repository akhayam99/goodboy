import { InlineMarkdown, type FreshTail } from '@goodboy/ui';
import type { AskHandle } from '../../askHandles';
import type { AskInline } from '../../parseAskAnswer';
import { AskChip } from './AskChip';

type Props = {
  readonly inlines: ReadonlyArray<AskInline>;
  readonly freshOf?: ReadonlyMap<AskInline, FreshTail>;
  readonly onOpen: (handle: AskHandle) => void;
};

export const AskInlines = ({ inlines, freshOf, onOpen }: Props) => (
  <>
    {inlines.map((inline, index) => {
      if (inline.kind === 'chip') {
        return (
          <span
            key={`chip-${index}`}
            data-ask-kind={inline.handle.target.kind}
            className="inline-flex px-0.5 align-middle"
          >
            <AskChip handle={inline.handle} onOpen={onOpen} />
          </span>
        );
      }
      const text = (
        <InlineMarkdown key={`text-${index}`} text={inline.text} fresh={freshOf?.get(inline)} />
      );
      return inline.isBold ? <strong key={`strong-${index}`}>{text}</strong> : text;
    })}
  </>
);
