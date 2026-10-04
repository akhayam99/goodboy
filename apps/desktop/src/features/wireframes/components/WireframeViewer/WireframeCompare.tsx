import { useMemo, useRef, useState } from 'react';
import {
  diffWireframeDocuments,
  parseWireframeSource,
  type WireframeDocument,
  type WireframeNodeChange,
} from '@goodboy/core';
import { Button } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { postToFrame } from '../../frame/frameMessage';
import { describeWireframeChange, wireframeCompareMarks } from '../../wireframeCompare';
import { wireframeVersionLabel, type WireframeVersion } from '../../wireframeVersion';
import { ChangeList } from './ChangeList';
import { CHANGE_GLYPH, CHANGE_WORD } from './changePresentation';
import { CompareSide } from './CompareSide';
import { RevisionPicker } from './RevisionPicker';
import { ScreenRail } from './ScreenRail';

type Side = Readonly<{ version: WireframeVersion; document: WireframeDocument }>;

type Props = {
  readonly artifact: WireframeArtifact;
  readonly versions: ReadonlyArray<WireframeVersion>;
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly onChange: (params: { readonly before: number; readonly after: number }) => void;
  readonly onExit: () => void;
};

const sideOf = ({
  versions,
  revision,
}: {
  readonly versions: ReadonlyArray<WireframeVersion>;
  readonly revision: number;
}): Side | null => {
  const version = versions.find((entry) => entry.revision === revision) ?? null;
  if (version === null) {
    return null;
  }
  const parsed = parseWireframeSource({ source: version.sourceText });
  return parsed.status === 'valid' ? { version, document: parsed.document } : null;
};

export const WireframeCompare = ({
  artifact,
  versions,
  beforeRevision,
  afterRevision,
  onChange,
  onExit,
}: Props) => {
  const beforeFrame = useRef<HTMLIFrameElement>(null);
  const afterFrame = useRef<HTMLIFrameElement>(null);
  const before = useMemo(
    () => sideOf({ versions, revision: beforeRevision }),
    [versions, beforeRevision],
  );
  const after = useMemo(
    () => sideOf({ versions, revision: afterRevision }),
    [versions, afterRevision],
  );
  const diff = useMemo(
    () =>
      before === null || after === null
        ? null
        : diffWireframeDocuments({ before: before.document, after: after.document }),
    [before, after],
  );
  const marks = useMemo(() => (diff === null ? null : wireframeCompareMarks({ diff })), [diff]);
  const firstChanged =
    diff?.screens.find((screen) => screen.change !== 'same')?.screenId ??
    diff?.screens[0]?.screenId ??
    null;
  const [picked, setPicked] = useState<string | null>(null);
  const screenId = picked ?? firstChanged;

  if (before === null || after === null || diff === null || marks === null || screenId === null) {
    return (
      <div data-testid="wireframe-compare" className="flex min-w-0 flex-col gap-2">
        <p className="text-meta text-muted-foreground">
          One of these versions does not pass the checks, so there is nothing to lay side by side.
        </p>
        <Button variant="ghost" size="sm" onClick={onExit} className="self-start">
          Exit
        </Button>
      </div>
    );
  }

  const railEntries = diff.screens.map((screen) => ({
    id: screen.screenId,
    title: screen.title,
    states: [],
    badge: (
      <span
        data-testid="wireframe-compare-badge"
        data-change={screen.change}
        className="shrink-0 text-meta text-muted-foreground"
      >
        <span aria-hidden className="font-mono">
          {CHANGE_GLYPH[screen.change]}
        </span>{' '}
        {CHANGE_WORD[screen.change]}
      </span>
    ),
  }));
  const changes = diff.nodes
    .filter((change) => change.screenId === screenId)
    .map((change) => ({
      change,
      text: describeWireframeChange({ change, before: before.document, after: after.document }),
    }));
  const reveal = (change: WireframeNodeChange) => {
    if (change.change !== 'added' && change.previousNodeId !== null) {
      postToFrame({
        frame: beforeFrame.current,
        command: { type: 'reveal', nodeId: change.previousNodeId },
      });
    }
    if (change.change !== 'removed') {
      postToFrame({
        frame: afterFrame.current,
        command: { type: 'reveal', nodeId: change.nodeId },
      });
    }
  };

  return (
    <div data-testid="wireframe-compare" className="@container flex min-w-0 flex-col gap-3">
      <div
        data-testid="wireframe-compare-bar"
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        <span className="text-body text-foreground">Compare</span>
        <RevisionPicker
          label="Compare from"
          versions={versions}
          value={before.version.revision}
          onChange={(revision) => onChange({ before: revision, after: after.version.revision })}
        />
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <RevisionPicker
          label="Compare to"
          versions={versions}
          value={after.version.revision}
          onChange={(revision) => onChange({ before: before.version.revision, after: revision })}
        />
        <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
          {wireframeVersionLabel({ version: after.version })}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit} data-testid="wireframe-compare-exit">
          Exit
        </Button>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 @[1100px]:grid-cols-[200px_minmax(0,1fr)]">
        <ScreenRail
          entries={railEntries}
          current={{ screenId, state: null }}
          onOpen={(page) => setPicked(page.screenId)}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid min-w-0 grid-cols-2 gap-4">
            <CompareSide
              frameRef={beforeFrame}
              artifact={artifact}
              document={before.document}
              marks={marks.before}
              screenId={screenId}
              side="A"
              revision={before.version.revision}
            />
            <CompareSide
              frameRef={afterFrame}
              artifact={artifact}
              document={after.document}
              marks={marks.after}
              screenId={screenId}
              side="B"
              revision={after.version.revision}
            />
          </div>
          <ChangeList changes={changes} onReveal={reveal} />
        </div>
      </div>
    </div>
  );
};
