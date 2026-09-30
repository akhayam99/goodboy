import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { GhTokenStatus } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { ghStatus, tauriGhRunner } from '../../integrations/github/github';
import { DEFAULT_ISSUE_TYPE } from '../../settings/reportIssueTypes';
import { collectCrashContext } from '../crashReport';
import { contextParts, type ReportPart } from '../reportBody';
import type { ReportFiled } from '../reportDestination';
import { ReportComposer, type ReportDraft, type ReportLinkOpened } from './ReportComposer';

type Props = {
  readonly heading: string;
  readonly initialLine: string;
  readonly errorPart: ReportPart;
};

type Outcome =
  | { readonly kind: 'filed'; readonly filed: ReportFiled }
  | { readonly kind: 'opened'; readonly opened: ReportLinkOpened };

const ABSENT: GhTokenStatus = { mode: 'absent', available: false };

export const CrashReport = ({ heading, initialLine, errorPart }: Props) => {
  const [draft, setDraft] = useState<ReportDraft>({
    issueType: DEFAULT_ISSUE_TYPE,
    title: initialLine,
    description: '',
  });
  const [context, setContext] = useState<ReadonlyArray<ReportPart>>([]);
  const [github, setGithub] = useState<GhTokenStatus | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    void collectCrashContext().then((collected) => {
      if (!cancelled) {
        setContext(contextParts({ context: collected }));
      }
    });
    void ghStatus()
      .catch(() => ABSENT)
      .then((status) => {
        if (!cancelled) {
          setGithub(status);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parts = useMemo(() => [errorPart, ...context], [errorPart, context]);
  const onDraftChange = useCallback(
    (patch: Partial<ReportDraft>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );
  const onDraftClear = useCallback(() => undefined, []);

  if (outcome?.kind === 'filed') {
    const url = outcome.filed.url;
    const where = outcome.filed.number == null ? 'on GitHub' : `#${outcome.filed.number}`;
    return (
      <Notice
        tone="success"
        placement="inline"
        role="status"
        title={outcome.filed.kind === 'comment' ? `Added to ${where}` : `Issue ${where} filed`}
        body="Thanks. Try again above when you are ready."
        actions={
          url == null ? undefined : (
            <Button variant="secondary" size="sm" onClick={() => void openUrl(url)}>
              View issue
              <ExternalLink size={ICON_SIZE.row} aria-hidden />
            </Button>
          )
        }
      />
    );
  }

  if (outcome?.kind === 'opened') {
    return (
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title="Finish on GitHub"
        body={
          outcome.opened.overflows
            ? 'The rest did not fit the link and is on your clipboard. Paste it into the issue, then submit.'
            : 'Submit the form in your browser to file the issue.'
        }
      />
    );
  }

  return (
    <ReportComposer
      heading={heading}
      variant="inline"
      parts={parts}
      draft={draft}
      onDraftChange={onDraftChange}
      onDraftClear={onDraftClear}
      github={github}
      runner={tauriGhRunner}
      hasTypeControl={false}
      linePlaceholder="What you were doing when it broke"
      selectLineOnMount
      onFiled={(filed) => setOutcome({ kind: 'filed', filed })}
      onOpenedLink={(opened) => setOutcome({ kind: 'opened', opened })}
    />
  );
};
