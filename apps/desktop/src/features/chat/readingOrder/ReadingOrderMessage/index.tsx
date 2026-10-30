import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Button,
  CodeBlockActionsContext,
  Markdown,
  estimateRenderedLines,
  type FreshTail,
  type Tone,
} from '@goodboy/ui';
import { AssistantCodeActions } from '../../components/TranscriptCards/AssistantCodeActions';
import {
  CodeActionTargetContext,
  type CodeActionTarget,
} from '../../components/TranscriptCards/codeActionTarget';
import { OutcomeLine } from '../OutcomeLine';
import { READING_BUDGETS } from '../readingBudgets';
import { cutAtBlockOf } from '../cutAtBlockOf';

type Props = {
  text: string;
  fresh?: FreshTail | undefined;
  codeTarget: CodeActionTarget;
  clampLines: number | null;
  outcome?: { text: string; tone: Tone } | null;
  chips?: ReadonlyArray<ReactNode>;
  children?: ReactNode;
};

type ClampStyleParams = {
  readonly lines: number;
  readonly cutPx: number | null;
};

const clampStyleOf = ({ lines, cutPx }: ClampStyleParams): CSSProperties =>
  cutPx === null
    ? {
        maxHeight: `${lines}lh`,
        overflow: 'hidden',
        maskImage: 'linear-gradient(to bottom, black calc(100% - 2lh), transparent)',
      }
    : { maxHeight: cutPx, overflow: 'hidden' };

export const ReadingOrderMessage = ({
  text,
  fresh,
  codeTarget,
  clampLines,
  outcome = null,
  chips = [],
  children,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChipListExpanded, setIsChipListExpanded] = useState(false);
  const isClamped = clampLines !== null && estimateRenderedLines({ text }) > clampLines;
  const isCut = isClamped && !isExpanded;
  const clampRef = useRef<HTMLDivElement>(null);
  const [cutPx, setCutPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = clampRef.current;
    if (box === null || !isCut || clampLines === null) {
      setCutPx(null);
      return;
    }
    setCutPx(cutAtBlockOf({ box, lines: clampLines }));
  }, [isCut, clampLines, text]);
  const shownChips = isChipListExpanded ? chips : chips.slice(0, READING_BUDGETS.maxChips);
  const hiddenChipCount = chips.length - shownChips.length;
  return (
    <>
      {outcome === null ? null : <OutcomeLine text={outcome.text} tone={outcome.tone} />}
      {text.length > 0 ? (
        <CodeActionTargetContext.Provider value={codeTarget}>
          <CodeBlockActionsContext.Provider value={AssistantCodeActions}>
            <div
              ref={clampRef}
              data-clamped={isCut}
              className="min-w-0"
              style={
                isCut && clampLines !== null
                  ? clampStyleOf({ lines: clampLines, cutPx })
                  : undefined
              }
            >
              <Markdown text={text} fresh={fresh} />
            </div>
          </CodeBlockActionsContext.Provider>
        </CodeActionTargetContext.Provider>
      ) : null}
      {isClamped ? (
        <Button
          variant="quiet"
          size="xs"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((wasExpanded) => !wasExpanded)}
          className="w-fit self-start px-0 hover:bg-transparent"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </Button>
      ) : null}
      {children}
      {chips.length > 0 ? (
        <div data-testid="reading-chips" className="flex flex-wrap items-center gap-2">
          {shownChips}
          {hiddenChipCount > 0 ? (
            <Button variant="quiet" size="xs" onClick={() => setIsChipListExpanded(true)}>
              {`+${hiddenChipCount}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
