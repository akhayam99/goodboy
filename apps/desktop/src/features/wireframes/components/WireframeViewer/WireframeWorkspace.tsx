import { useCallback, useMemo, useRef, useState } from 'react';
import {
  diffWireframeDocuments,
  parseWireframeSource,
  type WireframeAdjustment,
  type WireframeDocument,
} from '@goodboy/core';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { useWireframeImport } from '../../useWireframeImport';
import { useWireframeIteration } from '../../useWireframeIteration';
import { WireframeImportNotice } from '../WireframeImportNotice';
import { useWireframeVersions } from '../../useWireframeVersions';
import { diffChangeCount } from '../../wireframeCompare';
import { ChangeComposer } from './ChangeComposer';
import { DraftBanner } from './DraftBanner';
import { VersionMenu } from './VersionMenu';
import { WireframeCompare } from './WireframeCompare';
import { WireframeViewerBody } from './WireframeViewerBody';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
  readonly onScreenChange?: (screenId: string | null) => void;
};

export const WireframeWorkspace = ({
  sessionId,
  artifact,
  document,
  adjustments,
  onScreenChange,
}: Props) => {
  const versions = useWireframeVersions({ artifactId: artifact.id, revision: artifact.revision });
  const creator = useAppStore(
    (s) =>
      (s.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === artifact.agentId) ?? null,
  );
  const [viewing, setViewing] = useState<number | null>(null);
  const [compare, setCompare] = useState<Readonly<{ before: number; after: number }> | null>(null);
  const [screen, setScreen] = useState<Readonly<{ id: string; title: string }> | null>(null);
  const iteration = useWireframeIteration({ sessionId, artifact, screen });
  const viewed = viewing === null ? null : (versions.find((v) => v.revision === viewing) ?? null);
  const viewedDocument = useMemo(() => {
    if (viewed === null) {
      return null;
    }
    const parsed = parseWireframeSource({ source: viewed.sourceText });
    return parsed.status === 'valid' ? parsed.document : null;
  }, [viewed]);
  const isOld = viewed !== null && viewedDocument !== null;
  const shownDocument = isOld && viewedDocument !== null ? viewedDocument : document;
  const draft = iteration.draft;
  const isDrafting = draft?.status === 'drafting';
  const agentName = creator?.name ?? 'Wireframe agent';
  const replaceWireframeSpec = useAppStore((s) => s.replaceWireframeSpec);
  const replacer = useWireframeImport({
    commit: (ready) => replaceWireframeSpec({ sessionId, artifact, sourceText: ready.sourceText }),
  });
  const readyChanges = useMemo(() => {
    if (draft?.status !== 'ready') {
      return null;
    }
    const parse = (revision: number) => {
      const version = versions.find((entry) => entry.revision === revision) ?? null;
      const parsed = version === null ? null : parseWireframeSource({ source: version.sourceText });
      return parsed?.status === 'valid' ? parsed.document : null;
    };
    const from = parse(draft.fromRevision);
    const to = parse(draft.toRevision);
    return from === null || to === null
      ? null
      : diffChangeCount({ diff: diffWireframeDocuments({ before: from, after: to }) });
  }, [draft, versions]);
  const model = creator?.modelOverride ?? null;

  const latest = useRef({ shownDocument, onScreenChange });
  latest.current = { shownDocument, onScreenChange };
  const handleScreenChange = useCallback((screenId: string | null) => {
    const found =
      latest.current.shownDocument.screens.find((entry) => entry.id === screenId) ?? null;
    setScreen((previous) => {
      if (previous?.id === found?.id && previous?.title === found?.title) {
        return previous;
      }
      return found === null ? null : { id: found.id, title: found.title };
    });
    latest.current.onScreenChange?.(screenId);
  }, []);

  const banner = (
    <>
      {isDrafting ? (
        <div
          role="progressbar"
          aria-label={`Drafting v${draft.fromRevision + 1}`}
          data-testid="wireframe-draft-progress"
          className="h-0.5 w-full overflow-hidden rounded-full bg-subtle"
        >
          <div className="h-full w-2/5 bg-primary motion-safe:animate-soft-pulse" />
        </div>
      ) : null}
      {draft !== null && draft.status !== 'drafting' ? (
        <DraftBanner
          draft={draft}
          changeCount={readyChanges}
          onCompare={() => {
            if (draft.status === 'ready') {
              setCompare({ before: draft.fromRevision, after: draft.toRevision });
            }
          }}
          currentRevision={artifact.revision}
          onAskAgain={iteration.askAgain}
          onDismiss={iteration.dismiss}
        />
      ) : null}
      {isOld && viewed !== null ? (
        <Notice
          tone="info"
          placement="inline"
          role="status"
          title={`You are viewing v${viewed.revision} of ${artifact.revision}.`}
          actions={
            <span className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
                Back to v{artifact.revision}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  iteration.restore(viewed.revision);
                  setViewing(null);
                }}
              >
                Restore v{viewed.revision}
              </Button>
            </span>
          }
        />
      ) : null}
      {replacer.pending === null ? null : (
        <WireframeImportNotice
          pending={replacer.pending}
          isBusy={replacer.isBusy}
          error={replacer.error}
          confirmLabel={
            replacer.pending.status === 'ready' && replacer.pending.adjustments.length > 0
              ? 'Replace anyway'
              : 'Replace'
          }
          onConfirm={replacer.confirm}
          onCancel={replacer.cancel}
        />
      )}
      {replacer.pending === null && replacer.error !== null ? (
        <span role="alert" className="text-secondary text-danger">
          {replacer.error}
        </span>
      ) : null}
      {iteration.restoreError === null ? null : (
        <span role="alert" className="text-secondary text-danger">
          {iteration.restoreError}
        </span>
      )}
    </>
  );

  if (compare !== null) {
    return (
      <WireframeCompare
        artifact={artifact}
        versions={versions}
        beforeRevision={compare.before}
        afterRevision={compare.after}
        onChange={setCompare}
        onExit={() => setCompare(null)}
      />
    );
  }

  return (
    <WireframeViewerBody
      artifact={artifact}
      document={shownDocument}
      adjustments={adjustments}
      onScreenChange={handleScreenChange}
      revisionKey={isOld && viewed !== null ? viewed.revision : artifact.revision}
      {...(isOld && viewed !== null ? { stageTitle: viewed.title } : {})}
      leading={
        <VersionMenu
          versions={versions}
          currentRevision={artifact.revision}
          viewingRevision={isOld && viewed !== null ? viewed.revision : artifact.revision}
          drafting={isDrafting ? { revision: draft.fromRevision + 1, ask: draft.ask } : null}
          agentName={agentName}
          onView={(revision) => setViewing(revision === artifact.revision ? null : revision)}
          onCompare={(revision) => setCompare({ before: revision, after: artifact.revision })}
          onRestore={iteration.restore}
          onReplace={replacer.pick}
        />
      }
      banner={banner}
      isPicking={iteration.isPicking}
      onPicked={iteration.pick}
      onPickEnded={() => iteration.setIsPicking(false)}
      renderComposer={(current) =>
        isOld ? null : (
          <ChangeComposer
            ask={iteration.ask}
            onAskChange={iteration.setAsk}
            screenTitle={iteration.scope === 'screen' ? current.title : null}
            picked={iteration.picked}
            onUnpick={iteration.unpick}
            isPicking={iteration.isPicking}
            onTogglePick={() => iteration.setIsPicking(!iteration.isPicking)}
            scope={iteration.scope}
            onScopeChange={iteration.setScope}
            modelLabel={model === null ? null : modelLabel(model)}
            isBusy={isDrafting}
            onSend={iteration.send}
          />
        )
      }
    />
  );
};
