import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { listArtifactsForSession } from '../../../artifacts/artifacts';
import {
  ArtifactDocument,
  type ArtifactDocumentMedium,
} from '../../../artifacts/components/ArtifactDocument';
import { useRecordArtifactOpened } from '../../../artifacts/hooks/useRecordArtifactOpened';
import type { ArtifactPrintRequest } from '../../artifactPrintRequest';
import { artifactMetaFields } from './artifactMetaFields';
import { closePrintWindow } from './closePrintWindow';
import { openPrintDialog } from './openPrintDialog';
import { PrintLetterhead } from './PrintLetterhead';
import { ReaderToolbar } from './ReaderToolbar';
import { removeBootShell } from './removeBootShell';

type Props = {
  readonly request: ArtifactPrintRequest;
};

type Status =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; artifact: SessionArtifact }>
  | Readonly<{ kind: 'unsupported'; artifact: SessionArtifact }>
  | Readonly<{ kind: 'failed'; message: string }>;

const PRINT_UNSUPPORTED_COPY =
  'a wireframe opens in the browser from its page in the app, so this window has nothing to lay out';

const SOURCE_IS_SAFE = 'the source is still available in the app, so nothing was lost.';

type ArtifactStatusParams = {
  readonly artifact: SessionArtifact;
};

const artifactStatus = ({ artifact }: ArtifactStatusParams): Status => {
  if (artifact.sourceFormat === 'markdown') {
    return { kind: 'ready', artifact };
  }
  return { kind: 'unsupported', artifact };
};

const isPrintShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p';

export const ArtifactReaderView = ({ request }: Props) => {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [printError, setPrintError] = useState<string | null>(null);
  const hasPrinted = useRef(false);
  const isReading = request.mode === 'read';
  const medium: ArtifactDocumentMedium = isReading ? 'window' : 'paper';
  const canPrint = status.kind === 'ready';
  useRecordArtifactOpened({
    artifactId:
      isReading && status.kind !== 'loading' && status.kind !== 'failed'
        ? request.artifactId
        : null,
  });

  const print = useCallback(() => {
    setPrintError(null);
    openPrintDialog({ onFailure: setPrintError });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-print-window', 'true');
    removeBootShell();
    let isActive = true;
    listArtifactsForSession(request.sessionId)
      .then((artifacts) => {
        if (!isActive) {
          return;
        }
        const found = artifacts.find((entry) => entry.id === request.artifactId) ?? null;
        if (found === null) {
          setStatus({ kind: 'failed', message: 'this artifact is no longer in the session' });
          return;
        }
        setStatus(artifactStatus({ artifact: found }));
      })
      .catch((cause: unknown) => {
        if (isActive) {
          setStatus({ kind: 'failed', message: formatError(cause) });
        }
      });
    return () => {
      isActive = false;
    };
  }, [request.sessionId, request.artifactId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void closePrintWindow();
        return;
      }
      if (!isReading || !canPrint || !isPrintShortcut(event)) {
        return;
      }
      event.preventDefault();
      print();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPrint, isReading, print]);

  useEffect(() => {
    if (isReading || !canPrint || hasPrinted.current) {
      return;
    }
    hasPrinted.current = true;
    const frame = globalThis.requestAnimationFrame(print);
    return () => globalThis.cancelAnimationFrame(frame);
  }, [canPrint, isReading, print]);

  return (
    <div
      data-testid="artifact-reader-view"
      className="print-sheet"
      data-page="portrait"
      data-medium={medium}
    >
      {isReading && status.kind === 'ready' ? (
        <ReaderToolbar artifact={status.artifact} onPrint={print} />
      ) : null}
      {status.kind === 'loading' ? <p className="print-note">preparing the document</p> : null}
      {printError === null ? null : (
        <p role="alert" className="print-note">
          {printError}. {SOURCE_IS_SAFE}
        </p>
      )}
      {status.kind === 'failed' ? (
        <p role="alert" className="print-note">
          {status.message}. {SOURCE_IS_SAFE}
        </p>
      ) : null}
      {status.kind === 'unsupported' ? (
        <article className="print-document" data-medium={medium}>
          <PrintLetterhead
            kind={status.artifact.kind}
            title={status.artifact.title}
            fields={artifactMetaFields({ artifact: status.artifact })}
          />
          <p role="alert" className="print-note">
            {PRINT_UNSUPPORTED_COPY}. the {status.artifact.sourceFormat} source is still available
            in the app, so nothing was lost.
          </p>
        </article>
      ) : null}
      {status.kind === 'ready' ? (
        <ArtifactDocument artifact={status.artifact} medium={medium} />
      ) : null}
    </div>
  );
};
