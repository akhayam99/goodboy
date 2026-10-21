import { Markdown } from '@goodboy/ui';
import { useRevealedMarkdown } from './useRevealedMarkdown';

type Props = {
  readonly liveKey: string;
  readonly itemKey: string;
  readonly text: string;
  readonly isComplete?: boolean;
  readonly className?: string;
};

export const RevealedMarkdown = ({
  liveKey,
  itemKey,
  text,
  isComplete = true,
  className,
}: Props) => {
  const reveal = useRevealedMarkdown({ runId: liveKey, itemKey, text, isComplete });
  return (
    <div ref={reveal.rootRef} aria-busy={reveal.isRevealing ? true : undefined} className="min-w-0">
      {reveal.text === '' ? null : (
        <Markdown text={reveal.text} fresh={reveal.fresh} className={className} />
      )}
    </div>
  );
};
