import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
import { hasUnclampableBlock } from '../hasUnclampableBlock';
import { READING_BUDGETS } from '../readingBudgets';
import { cutAtBlockOf, type ClampCut } from '../cutAtBlockOf';

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
  readonly cut: ClampCut;
};

const LINES_CUT: ClampCut = { kind: 'lines' };

const clampStyleOf = ({ lines, cut }: ClampStyleParams): CSSProperties | undefined => {
  if (cut.kind === 'fits') {
    return undefined;
  }
  if (cut.kind === 'block') {
    return { maxHeight: cut.px, overflow: 'hidden' };
  }
  return {
    maxHeight: `${lines}lh`,
    overflow: 'hidden',
    maskImage: 'linear-gradient(to bottom, black calc(100% - 2lh), transparent)',
  };
};

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
  const hasCodeOrTable = useMemo(() => hasUnclampableBlock({ text }), [text]);
  const isClamped =
    clampLines !== null && !hasCodeOrTable && estimateRenderedLines({ text }) > clampLines;
  const isCut = isClamped && !isExpanded;
  const clampRef = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState<ClampCut>(LINES_CUT);
  useLayoutEffect(() => {
    const box = clampRef.current;
    if (box === null || !isCut || clampLines === null) {
      setCut(LINES_CUT);
      return undefined;
    }
    const measure = () => setCut(cutAtBlockOf({ box, lines: clampLines }));
    measure();
    const content = box.firstElementChild;
    if (content === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isCut, clampLines, text]);
  const hasMore = isClamped && (isExpanded || cut.kind !== 'fits');
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
              data-clamped={isCut && cut.kind !== 'fits'}
              className="min-w-0"
              style={
                isCut && clampLines !== null ? clampStyleOf({ lines: clampLines, cut }) : undefined
              }
            >
              <Markdown text={text} fresh={fresh} />
            </div>
          </CodeBlockActionsContext.Provider>
        </CodeActionTargetContext.Provider>
      ) : null}
      {hasMore ? (
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
