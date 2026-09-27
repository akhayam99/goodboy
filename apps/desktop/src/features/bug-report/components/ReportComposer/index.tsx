import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ExternalLink, Laptop, MapPin, Tag, Terminal, BellRing } from 'lucide-react';
import type { GhRunner } from '@goodboy/core';
import type { GhTokenStatus } from '@goodboy/types';
import {
  Listbox,
  ReportSheet,
  formatError,
  type ReportSheetAttachment,
  type ReportSheetVariant,
} from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { formatCombo } from '../../../../shared/keyboard/registry';
import { ISSUE_TYPE_OPTIONS, type IssueTypeValue } from '../../../settings/reportIssueTypes';
import {
  NEVER_SENT,
  buildReport,
  buildReportLink,
  previewSummary,
  type ReportPart,
  type ReportPartId,
} from '../../reportBody';
import {
  addReportComment,
  fileReportIssue,
  findSimilarIssue,
  sendsDirectly,
  type ReportFiled,
  type SimilarIssue,
} from '../../reportDestination';

export type ReportDraft = {
  readonly issueType: IssueTypeValue;
  readonly title: string;
  readonly description: string;
};

export type ReportLinkOpened = {
  readonly overflows: boolean;
};

type Props = {
  readonly heading: string;
  readonly variant: ReportSheetVariant;
  readonly parts: ReadonlyArray<ReportPart>;
  readonly draft: ReportDraft;
  readonly onDraftChange: (patch: Partial<ReportDraft>) => void;
  readonly onDraftClear: () => void;
  readonly github: GhTokenStatus | null;
  readonly runner: GhRunner;
  readonly hasTypeControl: boolean;
  readonly linePlaceholder: string;
  readonly selectLineOnMount?: boolean;
  readonly onClose?: () => void;
  readonly onFiled: (filed: ReportFiled) => void;
  readonly onOpenedLink: (opened: ReportLinkOpened) => void;
};

const PART_ICONS: Readonly<Record<ReportPartId, ReactNode>> = {
  version: <Tag size={ICON_SIZE.row} />,
  system: <Laptop size={ICON_SIZE.row} />,
  screen: <MapPin size={ICON_SIZE.row} />,
  cliVersions: <Terminal size={ICON_SIZE.row} />,
  error: <AlertTriangle size={ICON_SIZE.row} />,
  notice: <BellRing size={ICON_SIZE.row} />,
};

const TYPE_OPTIONS = ISSUE_TYPE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

const DETAIL_PLACEHOLDER = 'What you did, what you expected, what happened instead';

const SEARCH_DELAY_MS = 500;

const NO_PARTS: ReadonlySet<ReportPartId> = new Set();

type SendState = 'idle' | 'sending' | 'adding';

type DestinationParams = {
  readonly github: GhTokenStatus | null;
  readonly direct: boolean;
  readonly overflows: boolean;
};

const destinationText = ({ github, direct, overflows }: DestinationParams): string => {
  if (github == null) {
    return 'Checking your GitHub connection';
  }
  if (direct) {
    return github.user == null
      ? 'Public issue on GitHub, under your account'
      : `Public issue on GitHub as @${github.user}`;
  }
  return overflows
    ? 'Opens GitHub in your browser. What does not fit the link goes to your clipboard.'
    : 'Opens GitHub in your browser. You submit it there.';
};

const similarMeta = ({ issue }: { readonly issue: SimilarIssue }): string =>
  issue.comments === 0
    ? 'open'
    : `open · ${issue.comments} ${issue.comments === 1 ? 'comment' : 'comments'}`;

export const ReportComposer = ({
  heading,
  variant,
  parts,
  draft,
  onDraftChange,
  onDraftClear,
  github,
  runner,
  hasTypeControl,
  linePlaceholder,
  selectLineOnMount = false,
  onClose,
  onFiled,
  onOpenedLink,
}: Props) => {
  const [excluded, setExcluded] = useState<ReadonlySet<ReportPartId>>(NO_PARTS);
  const [similar, setSimilar] = useState<SimilarIssue | null>(null);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [error, setError] = useState<string | null>(null);
  const direct = sendsDirectly({ status: github });

  const report = useMemo(
    () =>
      buildReport({
        issueType: draft.issueType,
        line: draft.title,
        detail: draft.description,
        parts,
        excluded,
      }),
    [draft.issueType, draft.title, draft.description, parts, excluded],
  );
  const link = useMemo(
    () => (direct ? null : buildReportLink({ title: report.title, body: report.body })),
    [direct, report.title, report.body],
  );
  const summary = useMemo(() => previewSummary({ parts, excluded }), [parts, excluded]);
  const attachments = useMemo<ReadonlyArray<ReportSheetAttachment>>(
    () =>
      parts.map((part) => ({
        id: part.id,
        label: part.chip,
        icon: PART_ICONS[part.id],
        included: !excluded.has(part.id),
        isError: part.id === 'error',
      })),
    [parts, excluded],
  );

  useEffect(() => {
    if (!direct) {
      setSimilar(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findSimilarIssue({ runner, line: draft.title }).then((found) => {
        if (!cancelled) {
          setSimilar(found);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [direct, runner, draft.title]);

  const toggle = (id: string) => {
    setExcluded((current) => {
      const partId = parts.find((part) => part.id === id)?.id;
      if (partId == null) {
        return current;
      }
      return current.has(partId)
        ? new Set([...current].filter((kept) => kept !== partId))
        : new Set([...current, partId]);
    });
  };

  const finish = (filed: ReportFiled) => {
    setSendState('idle');
    onDraftClear();
    onFiled(filed);
  };

  const submit = async () => {
    if (report.title === '' || github == null || sendState !== 'idle') {
      return;
    }
    setError(null);
    if (!direct) {
      const opened = link ?? buildReportLink({ title: report.title, body: report.body });
      try {
        if (opened.overflows) {
          await navigator.clipboard?.writeText(`${report.title}\n\n${report.body}`);
        }
        await openUrl(opened.url);
        onDraftClear();
        onOpenedLink({ overflows: opened.overflows });
      } catch (err) {
        setError(`Could not open GitHub. ${formatError(err)}`);
      }
      return;
    }
    setSendState('sending');
    const result = await fileReportIssue({ runner, title: report.title, body: report.body });
    if (!result.ok) {
      setSendState('idle');
      setError(result.message);
      return;
    }
    finish(result.filed);
  };

  const addToSimilar = async () => {
    if (similar == null || report.title === '' || sendState !== 'idle') {
      return;
    }
    setError(null);
    setSendState('adding');
    const result = await addReportComment({
      runner,
      number: similar.number,
      body: `${report.title}\n\n${report.body}`,
    });
    if (!result.ok) {
      setSendState('idle');
      setError(result.message);
      return;
    }
    finish({ ...result.filed, url: result.filed.url ?? similar.url });
  };

  return (
    <ReportSheet
      heading={heading}
      icon={<CONCEPT_ICONS.reportIssue size={ICON_SIZE.control} />}
      variant={variant}
      typeControl={
        hasTypeControl ? (
          <Listbox
            ariaLabel="Report type"
            trigger="chip"
            size="sm"
            value={draft.issueType}
            options={TYPE_OPTIONS}
            onChange={(issueType: IssueTypeValue) => onDraftChange({ issueType })}
          />
        ) : undefined
      }
      line={draft.title}
      linePlaceholder={linePlaceholder}
      onLineChange={(title) => onDraftChange({ title })}
      detail={draft.description}
      detailPlaceholder={DETAIL_PLACEHOLDER}
      onDetailChange={(description) => onDraftChange({ description })}
      attachments={attachments}
      onToggleAttachment={toggle}
      preview={`${report.title}\n\n${report.body}`}
      previewSummary={summary}
      neverSent={NEVER_SENT}
      duplicate={
        similar == null
          ? null
          : { number: similar.number, title: similar.title, meta: similarMeta({ issue: similar }) }
      }
      isAddingToDuplicate={sendState === 'adding'}
      onAddToDuplicate={() => void addToSimilar()}
      destination={destinationText({ github, direct, overflows: link?.overflows ?? false })}
      submitLabel={direct || github == null ? 'Send' : 'Open on GitHub'}
      submitIcon={
        direct || github == null ? undefined : <ExternalLink size={ICON_SIZE.row} aria-hidden />
      }
      submitHint={formatCombo('cmd+Enter')}
      isSubmitting={sendState === 'sending'}
      canSubmit={report.title !== '' && github != null && sendState === 'idle'}
      onSubmit={() => void submit()}
      error={error}
      onClose={onClose}
      selectLineOnMount={selectLineOnMount}
    />
  );
};
