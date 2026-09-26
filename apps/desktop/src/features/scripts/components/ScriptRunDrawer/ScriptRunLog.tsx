import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button, ScrollFade } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { splitLogLines } from './splitLogLines';

type Props = {
  readonly stdout: string;
  readonly stderr: string;
  readonly placeholder: string | null;
};

const BOTTOM_SLACK_PX = 4;

export const ScriptRunLog = ({ stdout, stderr, placeholder }: Props) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const lines = useMemo(() => splitLogLines({ stdout, stderr }), [stderr, stdout]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!isFollowing || viewport === null) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [isFollowing, lines]);

  const onViewportScroll = () => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setIsFollowing(distance <= BOTTOM_SLACK_PX);
  };

  const jumpToLatest = () => {
    const viewport = viewportRef.current;
    if (viewport !== null) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    setIsFollowing(true);
  };

  return (
    <div className="relative flex min-h-40 flex-1 flex-col">
      <ScrollFade
        className="min-h-0 flex-1 rounded-md bg-subtle"
        viewportClassName="px-3 py-2"
        fadeFrom="subtle"
        fadeSize={24}
        viewportRef={viewportRef}
        onViewportScroll={onViewportScroll}
      >
        {lines.length === 0 && placeholder !== null ? (
          <p className="text-secondary text-muted-foreground">{placeholder}</p>
        ) : (
          <pre
            aria-label="Script output"
            className="flex flex-col whitespace-pre-wrap break-all font-mono text-2xs leading-relaxed text-foreground"
          >
            {lines.map((line, index) =>
              line.stream === 'stderr' ? (
                <span
                  key={index}
                  data-stream="stderr"
                  className="flex gap-2 border-l-2 border-danger pl-2"
                >
                  <span aria-hidden className="shrink-0 text-faint-foreground">
                    err
                  </span>
                  <span className="min-w-0">{line.text}</span>
                </span>
              ) : (
                <span key={index}>{line.text === '' ? ' ' : line.text}</span>
              ),
            )}
          </pre>
        )}
      </ScrollFade>
      {isFollowing ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="pointer-events-auto"
            onClick={jumpToLatest}
          >
            <ArrowDown size={ICON_SIZE.row} aria-hidden />
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  );
};
