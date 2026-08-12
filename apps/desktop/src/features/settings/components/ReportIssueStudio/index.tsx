import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Button,
  Divider,
  FieldRow,
  ScrollFade,
  SectionHeader,
  SegmentedTabs,
  Select,
  Skeleton,
  Textarea,
  cn,
  Input,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { formatError } from '../../../../shared/lib/errors';
import { openUrl } from '../../../../shared/lib/editor';
import { useAppStore } from '../../../../store';
import { tauriGhRunner } from '../../../github/github';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { ISSUE_TYPE_OPTIONS, issueTypeLabel, type IssueTypeValue } from '../../reportIssueTypes';
import { useBugReportImages } from '../../hooks/useBugReportImages';
import { BugReportImages } from '../BugReportImages';
import { AREA_OPTIONS, type AreaValue } from './areas';
import {
  buildFallbackIssue,
  buildIssueBody,
  isOpenableUrl,
  REPORT_ISSUE_REPO,
} from './issuePayload';
import { parseIssueCreateResult } from './parseIssueCreateResult';
import { previewHint } from './previewHint';
import { stageBugReportImages } from './stageImages';
import { truncationNotice } from './truncationNotice';
import { PANE_RHYTHM } from '../../../../shared/components/paneRhythm';

type Props = {
  readonly onClose: () => void;
};

type Params = {
  readonly requestClose: () => void;
};

type SendState = 'idle' | 'sending' | 'error';

export const ReportIssueStudio = ({ onClose }: Props) => {
  const version = useInstalledVersion();
  const status = useAppStore((s) => s.githubStatus);
  const refreshGithubStatus = useAppStore((s) => s.refreshGithubStatus);
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);

  const imageControl = useBugReportImages();

  const [area, setArea] = useState<AreaValue | ''>('');
  const [title, setTitle] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status == null) {
      void refreshGithubStatus();
    }
  }, [status, refreshGithubStatus]);

  const mode = status?.mode ?? null;
  const sendsDirectly = mode === 'gh-cli' || mode === 'pat';

  const trimmedTitle = title.trim();
  const trimmedNotes = draft.description.trim();
  const areaLabel = useMemo(
    () => AREA_OPTIONS.find((option) => option.value === area)?.label ?? '',
    [area],
  );
  const typeLabel = issueTypeLabel({ issueType: draft.issueType });

  const imageNames = useMemo(
    () => imageControl.images.map((image) => image.fileName),
    [imageControl.images],
  );

  const directBody = useMemo(
    () =>
      buildIssueBody({
        typeLabel,
        version: version ?? '',
        areaLabel,
        notes: trimmedNotes,
        imageNames,
      }),
    [typeLabel, version, areaLabel, trimmedNotes, imageNames],
  );
  const fallback = useMemo(
    () =>
      buildFallbackIssue({
        title: trimmedTitle,
        typeLabel,
        version: version ?? '',
        areaLabel,
        notes: trimmedNotes,
        imageNames,
      }),
    [trimmedTitle, typeLabel, version, areaLabel, trimmedNotes, imageNames],
  );

  const previewBody = sendsDirectly ? directBody : fallback.body;
  const previewTitle = sendsDirectly ? trimmedTitle : fallback.title;
  const previewTruncation = sendsDirectly
    ? null
    : truncationNotice({
        titleTruncated: fallback.titleTruncated,
        notesTruncated: fallback.notesTruncated,
      });

  const canSend =
    version != null &&
    area !== '' &&
    trimmedTitle !== '' &&
    mode != null &&
    sendState !== 'sending';

  const onSend = async ({ requestClose }: Params) => {
    if (!canSend) {
      return;
    }
    setSendState('sending');
    setErrorMessage(null);

    try {
      await stageBugReportImages({ images: imageControl.images });
    } catch (err) {
      setSendState('error');
      setErrorMessage(`Could not prepare the images to attach. ${formatError(err)}`);
      return;
    }

    if (sendsDirectly) {
      try {
        const res = await tauriGhRunner.run(
          [
            'issue',
            'create',
            '--repo',
            REPORT_ISSUE_REPO,
            '--title',
            trimmedTitle,
            '--body',
            directBody,
          ],
          {},
        );
        const parsed = parseIssueCreateResult(res);
        if (!parsed.ok) {
          setSendState('error');
          setErrorMessage(parsed.message);
          return;
        }
        if (parsed.url != null) {
          await openUrl(parsed.url);
        }
        clearBugReportDraft();
        requestClose();
      } catch (err) {
        setSendState('error');
        setErrorMessage(formatError(err));
      }
      return;
    }

    if (!isOpenableUrl(fallback.url)) {
      setSendState('error');
      setErrorMessage(
        'This report is too long for a GitHub link. Shorten the title or the notes and try again.',
      );
      return;
    }
    try {
      await openUrl(fallback.url);
      clearBugReportDraft();
      requestClose();
    } catch (err) {
      setSendState('error');
      setErrorMessage(formatError(err));
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.reportIssue}
      tone={CONCEPT_TONE.reportIssue}
      title="Report an issue"
      workspaceName="Posts to your own GitHub account"
      closeLabel="close report an issue"
      onClose={onClose}
    >
      {(requestClose) => (
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
              <section className="flex flex-col">
                <SectionHeader
                  icon={<CONCEPT_ICONS.reportIssue size={12} aria-hidden />}
                  label="Report details"
                  hint="What you type here is the whole report. Nothing else is read from the app."
                />
                <FieldRow label="Version" help="The version running right now.">
                  {version != null ? (
                    <span className="text-sm text-foreground">{version}</span>
                  ) : (
                    <Skeleton className="h-4 w-14" />
                  )}
                </FieldRow>
                <FieldRow label="Type" help="What kind of report this is.">
                  <SegmentedTabs
                    size="sm"
                    ariaLabel="Issue type"
                    options={ISSUE_TYPE_OPTIONS}
                    value={draft.issueType}
                    onChange={(issueType: IssueTypeValue) => setBugReportDraft({ issueType })}
                  />
                </FieldRow>
                <FieldRow label="Area" help="Which part of the app this is about.">
                  <Select
                    size="sm"
                    value={area}
                    onChange={(e) => setArea(e.target.value as AreaValue | '')}
                    required
                  >
                    <option value="" disabled hidden>
                      Choose an area
                    </option>
                    {AREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FieldRow>
                <FieldRow label="Title" help="A short summary.">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What's wrong, in one line"
                    className="w-full sm:w-80"
                  />
                </FieldRow>
                <FieldRow
                  label="Notes"
                  help="What happened, what you expected, steps to reproduce."
                  layout="stacked"
                >
                  <Textarea
                    autoGrow
                    minRows={4}
                    maxRows={12}
                    value={draft.description}
                    onChange={(e) => setBugReportDraft({ description: e.target.value })}
                    onPaste={imageControl.onPaste}
                    placeholder="Steps to reproduce, what you expected, what happened instead"
                  />
                </FieldRow>
                <FieldRow
                  label="Images"
                  help="Screenshots that show the problem. Their folder opens on send, so you can drag them into the issue."
                  layout="stacked"
                >
                  <BugReportImages control={imageControl} />
                </FieldRow>
              </section>

              <Divider />

              <section className="flex flex-col gap-3">
                <SectionHeader label="Preview" hint={previewHint({ mode })} />
                <div className="flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-foreground">
                  <p className="font-medium">{previewTitle === '' ? 'Untitled' : previewTitle}</p>
                  <p className="whitespace-pre-wrap text-foreground/85">{previewBody}</p>
                </div>
                {previewTruncation != null && (
                  <p className="text-2xs leading-relaxed text-warning">{previewTruncation}</p>
                )}
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  This posts publicly on GitHub, under your own account.
                </p>
              </section>
            </div>
          </ScrollFade>
          <Divider />
          <footer className="flex shrink-0 items-center gap-3 px-6 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {errorMessage != null ? (
                <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
                  <AlertTriangle size={12} aria-hidden />
                  {errorMessage}
                </span>
              ) : null}
            </div>
            <Button variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void onSend({ requestClose })}
              disabled={!canSend}
              className={cn(sendState === 'sending' && 'animate-border-pulse')}
            >
              {sendState === 'sending'
                ? sendsDirectly
                  ? 'Sending…'
                  : 'Opening…'
                : sendsDirectly
                  ? 'Send'
                  : 'Open on GitHub'}
            </Button>
          </footer>
        </div>
      )}
    </StudioShell>
  );
};
