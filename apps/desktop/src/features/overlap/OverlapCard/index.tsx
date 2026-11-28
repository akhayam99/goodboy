import { useEffect, useMemo, useRef } from 'react';
import { AnchoredPopover, Button, tintClasses, useDropdown, type Tone } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import { MergeStepRow } from './MergeStepRow';
import { OverlapActions } from './OverlapActions';
import { SharedFiles } from './SharedFiles';
import { overlapGroupOf } from '../overlapGroupOf';
import { overlapWordsOf } from '../overlapWordsOf';
import { useLiveMounts } from '../hooks/useLiveMounts';
import { useOverlapCardRequest } from '../hooks/useOverlapCardRequest';
import { useSessionLabels } from '../hooks/useSessionLabels';

type Props = {
  readonly mountId: MountId;
  readonly word: Readonly<{ word: string; tone: Tone }> | null;
  readonly facts: ReadonlyArray<string>;
};

export const OverlapCard = ({ mountId, word, facts }: Props) => {
  const { mounts } = useLiveMounts();
  const requested = useOverlapCardRequest({ mountId });
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    expectedWidth: 384,
    expectedHeight: 280,
  });
  const group = useMemo(() => overlapGroupOf({ mounts, mountId }), [mounts, mountId]);
  const sessionIds = useMemo(
    () => (group === null ? [] : [...new Set(group.steps.map((step) => step.mount.sessionId))]),
    [group],
  );
  const { labels: sessionLabels, titles: sessionTitles } = useSessionLabels({ sessionIds });
  const toggleRef = useRef(dropdown.toggle);
  toggleRef.current = dropdown.toggle;
  const isPointerRef = useRef(false);
  const isOpenRef = useRef(dropdown.open);
  isOpenRef.current = dropdown.open;
  const handledRef = useRef(requested);
  useEffect(() => {
    if (requested === handledRef.current) {
      return;
    }
    handledRef.current = requested;
    toggleRef.current();
  }, [requested]);
  if (word === null) {
    return null;
  }
  const toneClass = tintClasses(word.tone).text;
  if (group === null && facts.length === 0) {
    return (
      <span data-board-word="" className={toneClass}>
        {word.word}
      </span>
    );
  }
  const words = group === null ? null : overlapWordsOf({ group, sessionLabels });
  const title = words === null ? word.word : words.title;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      className="gap-3 p-3"
      anchorClassName="pointer-events-auto inline-flex min-w-0 max-w-full align-baseline"
      trigger={
        <Button
          variant="quiet"
          data-board-word=""
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={words === null ? word.word : `${word.word}, ${words.chip}`}
          onPointerDown={() => {
            isPointerRef.current = true;
          }}
          onFocus={() => {
            if (!isPointerRef.current && !isOpenRef.current) {
              dropdown.toggle();
            }
            isPointerRef.current = false;
          }}
          onClick={dropdown.toggle}
          className={`h-auto w-auto min-w-0 rounded-sm px-0 py-0 text-meta font-normal ${toneClass}`}
        >
          <span className="min-w-0 truncate">{word.word}</span>
        </Button>
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-heading text-foreground">{title}</h2>
        {words === null ? null : <p className="text-meta text-muted-foreground">{words.lead}</p>}
      </div>
      {facts.length === 0 ? null : (
        <ul aria-label="Also true" className="flex min-w-0 flex-col gap-1 text-meta">
          {facts.map((fact) => (
            <li key={fact} className="min-w-0 text-muted-foreground">
              {fact}
            </li>
          ))}
        </ul>
      )}
      {group === null || words === null ? null : (
        <>
          <ol aria-label="Merge order" className="flex min-w-0 flex-col gap-2">
            {group.steps.map((step, index) => (
              <MergeStepRow
                key={step.mount.mountId}
                step={step}
                position={index + 1}
                title={sessionTitles.get(step.mount.sessionId) ?? ''}
                reason={words.reasons[index] ?? ''}
              />
            ))}
          </ol>
          <SharedFiles paths={group.sharedPaths} label={words.shared} />
          <OverlapActions group={group} onDone={dropdown.close} />
        </>
      )}
    </AnchoredPopover>
  );
};
