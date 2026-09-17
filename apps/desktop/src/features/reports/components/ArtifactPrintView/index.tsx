import { useEffect, useRef, useState } from 'react';
import { parseWireframeSource, type WireframeDocument } from '@goodboy/core';
import { Markdown, formatError } from '@goodboy/ui';
import type { SessionArtifact, WireframeArtifact } from '@goodboy/types';
import { listArtifactsForSession } from '../../../artifacts/artifacts';
import type { ArtifactPrintRequest } from '../../artifactPrintRequest';
import { artifactMetaFields } from './artifactMetaFields';
import { CONTENTS_MIN_SECTIONS, documentOutline } from './documentOutline';
import { dropLeadingTitleHeading } from './dropLeadingTitleHeading';
import { PrintContents } from './PrintContents';
import { PrintLetterhead } from './PrintLetterhead';
import { PrintWireframeSheet } from './PrintWireframeSheet';
import { printPage } from './printPage';
import { removeBootShell } from './removeBootShell';
import './printSheet.css';

type Props = {
  readonly request: ArtifactPrintRequest;
};

type Status =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; artifact: SessionArtifact }>
  | Readonly<{ kind: 'wireframe'; artifact: WireframeArtifact; document: WireframeDocument }>
  | Readonly<{ kind: 'unsupported'; artifact: SessionArtifact }>
  | Readonly<{ kind: 'failed'; message: string }>;

const PRINT_UNSUPPORTED_COPY =
  'this wireframe does not match the schema, so the print sheet has no page to lay out';

const artifactStatus = ({ artifact }: { readonly artifact: SessionArtifact }): Status => {
  if (artifact.sourceFormat === 'markdown') {
    return { kind: 'ready', artifact };
  }
  const parsed = parseWireframeSource({ source: artifact.sourceText });
  if (parsed.status === 'invalid') {
    return { kind: 'unsupported', artifact };
  }
  return { kind: 'wireframe', artifact, document: parsed.document };
};

const PrintDocument = ({ artifact }: { readonly artifact: SessionArtifact }) => {
  const body = dropLeadingTitleHeading({
    sourceText: artifact.sourceText,
    title: artifact.title,
  });
  const sections = documentOutline({ sourceText: body });
  return (
    <article>
      <PrintLetterhead
        kind={artifact.kind}
        title={artifact.title}
        fields={artifactMetaFields({ artifact })}
      />
      {sections.length >= CONTENTS_MIN_SECTIONS ? <PrintContents sections={sections} /> : null}
      <div className="print-body">
        <Markdown text={body} />
      </div>
    </article>
  );
};

export const ArtifactPrintView = ({ request }: Props) => {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const hasPrinted = useRef(false);

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
    if ((status.kind !== 'ready' && status.kind !== 'wireframe') || hasPrinted.current) {
      return;
    }
    hasPrinted.current = true;
    const frame = globalThis.requestAnimationFrame(() => {
      try {
        const printed = window.print() as unknown;
        if (printed instanceof Promise) {
          printed.catch((cause: unknown) => {
            setStatus({
              kind: 'failed',
              message: `this system could not open a print dialog: ${formatError(cause)}`,
            });
          });
        }
      } catch (cause) {
        setStatus({
          kind: 'failed',
          message: `this system could not open a print dialog: ${formatError(cause)}`,
        });
      }
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [status]);

  const page = printPage({ document: status.kind === 'wireframe' ? status.document : null });

  return (
    <div data-testid="artifact-print-view" className="print-sheet" data-page={page}>
      {status.kind === 'loading' ? <p className="print-note">preparing the document</p> : null}
      {status.kind === 'failed' ? (
        <p role="alert" className="print-note">
          {status.message}. the source is still available in the app, so nothing was lost.
        </p>
      ) : null}
      {status.kind === 'unsupported' ? (
        <article>
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
      {status.kind === 'ready' ? <PrintDocument artifact={status.artifact} /> : null}
      {status.kind === 'wireframe' ? (
        <PrintWireframeSheet artifact={status.artifact} document={status.document} page={page} />
      ) : null}
    </div>
  );
};
