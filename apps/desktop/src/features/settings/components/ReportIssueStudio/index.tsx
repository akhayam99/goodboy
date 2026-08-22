import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Button,
  cn,
  Divider,
  FieldRow,
  formatError,
  Input,
  PANE_RHYTHM,
  ScrollFade,
  SectionSurface,
  SegmentedTabs,
  Select,
  Skeleton,
  Textarea,
} from '@goodboy/ui';
import { useToast } from '../../../../app/components/Toast';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { openUrl } from '../../../../shared/lib/editor';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { tauriGhRunner } from '../../../github/github';
import { useBugReportImages } from '../../hooks/useBugReportImages';
import { REPORT_ISSUE_REPO } from '../../issueUrl';
import { ISSUE_TYPE_OPTIONS, issueTypeLabel, type IssueTypeValue } from '../../reportIssueTypes';
import { BugReportImages } from '../BugReportImages';
import { AREA_OPTIONS, type AreaValue } from './areas';
import { guessArea } from './guessArea';
import { buildFallbackIssue, buildIssueBody, isOpenableUrl } from './issuePayload';
import { parseIssueCreateResult } from './parseIssueCreateResult';
import { previewHint } from './previewHint';
import { revealBugReportImages, stageBugReportImages, type StagedBugReport } from './stageImages';
import { truncationNotice } from './truncationNotice';
import { uploadIssueAttachments } from './uploadIssueAttachments';

type Props = {
  readonly onClose: () => void;
};

type Params = {
  readonly requestClose: () => void;
};

type SendState = 'idle' | 'sending' | 'error';

const TITLE_PLACEHOLDERS = {
  bug: "What's wrong, in one line",
  idea: "What you'd change, in one line",
  question: "What you're stuck on, in one line",
} satisfies Record<IssueTypeValue, string>;

const NOTES_PLACEHOLDERS = {
  bug: 'Steps to reproduce, what you expected, what happened instead',
  idea: "What it does today, what you'd want instead",
  question: 'What you tried, and where it stopped making sense',
} satisfies Record<IssueTypeValue, string>;

export const ReportIssueStudio = ({ onClose }: Props) => {
  const version = useInstalledVersion();
  const status = useAppStore((s) => s.githubStatus);
  const refreshGithubStatus = useAppStore((s) => s.refreshGithubStatus);
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);
  const { showToast } = useToast();
  const imageControl = useBugReportImages();
  const [selectedArea, setSelectedArea] = useState<AreaValue | ''>('');
  const [isAreaTouched, setIsAreaTouched] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status == null) {
      void refreshGithubStatus();
    }
  }, [status, refreshGithubStatus]);

  const mode = status?.mode ?? null;
  const sendsDirectly = mode === 'gh-cli' || mode === 'pat';
  const guessedArea = useMemo(
    () => guessArea({ text: `${draft.title}\n${draft.description}` }),
    [draft.title, draft.description],
  );
  const area = isAreaTouched ? selectedArea : (guessedArea ?? '');
  const isAreaGuessed = !isAreaTouched && guessedArea != null;
  const trimmedTitle = draft.title.trim();
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

    let staged: StagedBugReport | null;
    try {
      staged = await stageBugReportImages({ images: imageControl.images });
    } catch (err) {
      setSendState('error');
      setErrorMessage(`Could not prepare the images to attach. ${formatError(err)}`);
      return;
    }
    const stagedImagesDir = staged?.dir ?? null;

    if (sendsDirectly) {
      const uploaded =
        staged == null
          ? null
          : await uploadIssueAttachments({
              runner: tauriGhRunner,
              repo: REPORT_ISSUE_REPO,
              images: staged.images,
            });
      try {
        const result = await tauriGhRunner.run(
          [
            'issue',
            'create',
            '--repo',
            REPORT_ISSUE_REPO,
            '--title',
            trimmedTitle,
            '--body',
            uploaded == null
              ? directBody
              : buildIssueBody({
                  typeLabel,
                  version: version ?? '',
                  areaLabel,
                  notes: trimmedNotes,
                  uploadedImages: uploaded,
                }),
          ],
          {},
        );
        const parsed = parseIssueCreateResult(result);
        if (!parsed.ok) {
          setSendState('error');
          setErrorMessage(parsed.message);
          return;
        }
        const issueUrl = parsed.url;
        clearBugReportDraft();
        requestClose();
        if (stagedImagesDir == null || uploaded != null) {
          showToast(
            'success',
            uploaded == null
              ? 'Filed on GitHub, under your account.'
              : 'Filed on GitHub with your images, under your account.',
            {
              title: 'Issue sent',
              action:
                issueUrl == null
                  ? undefined
                  : { label: 'View issue', onClick: () => void openUrl(issueUrl) },
            },
          );
          return;
        }
        const action =
          issueUrl == null
            ? {
                label: 'Open images folder',
                onClick: () => void revealBugReportImages({ dir: stagedImagesDir }),
              }
            : {
                label: 'Open issue and images',
                onClick: () => {
                  void openUrl(issueUrl);
                  void revealBugReportImages({ dir: stagedImagesDir });
                },
              };
        showToast(
          'success',
          "Your images aren't on it yet. GitHub only takes them by drag and drop.",
          { title: 'Issue sent', persist: true, action },
        );
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
      if (stagedImagesDir != null) {
        await revealBugReportImages({ dir: stagedImagesDir });
      }
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
              <div className="flex flex-col gap-4">
                <SegmentedTabs
                  size="md"
                  fill
                  ariaLabel="Issue type"
                  options={ISSUE_TYPE_OPTIONS}
                  value={draft.issueType}
                  onChange={(issueType: IssueTypeValue) => setBugReportDraft({ issueType })}
                />
                <Input
                  aria-label="Title"
                  value={draft.title}
                  onChange={(e) => setBugReportDraft({ title: e.target.value })}
                  placeholder={TITLE_PLACEHOLDERS[draft.issueType]}
                  className="w-full"
                />
                <Textarea
                  autoGrow
                  minRows={4}
                  maxRows={12}
                  aria-label="Notes"
                  value={draft.description}
                  onChange={(e) => setBugReportDraft({ description: e.target.value })}
                  onPaste={imageControl.onPaste}
                  placeholder={NOTES_PLACEHOLDERS[draft.issueType]}
                />
                <FieldRow
                  label="Images"
                  help="Attached to the issue when you send. If GitHub turns them away, one click opens the issue and the folder, so you can drag them in."
                  layout="stacked"
                >
                  <BugReportImages control={imageControl} />
                </FieldRow>
                <FieldRow label="Area">
                  <div className="flex flex-col gap-2">
                    <Select
                      aria-label="Area"
                      size="sm"
                      value={area}
                      onChange={(e) => {
                        const nextArea = AREA_OPTIONS.find(
                          (option) => option.value === e.target.value,
                        )?.value;
                        setSelectedArea(nextArea ?? '');
                        setIsAreaTouched(true);
                      }}
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
                    {isAreaGuessed ? (
                      <p className="text-2xs leading-relaxed text-info">
                        Guessed from your words. Change it if it's off.
                      </p>
                    ) : null}
                  </div>
                </FieldRow>
              </div>

              <Divider />

              <SectionSurface
                label="Preview"
                ariaLabel="Preview"
                hint={previewHint({ mode })}
                headingSize="page"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-foreground">
                    <p className="font-medium">{previewTitle === '' ? 'Untitled' : previewTitle}</p>
                    <p className="whitespace-pre-wrap text-foreground/85">{previewBody}</p>
                  </div>
                  {previewTruncation != null ? (
                    <p className="text-2xs leading-relaxed text-warning">{previewTruncation}</p>
                  ) : null}
                </div>
              </SectionSurface>

              <footer className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {errorMessage != null ? (
                    <span
                      role="alert"
                      className="inline-flex items-center gap-1 text-xs text-danger"
                    >
                      <AlertTriangle size={12} aria-hidden />
                      {errorMessage}
                    </span>
                  ) : version != null ? (
                    <span className="text-2xs text-muted-foreground">
                      v{version} · Posts publicly on GitHub, under your account
                    </span>
                  ) : (
                    <Skeleton className="h-4 w-14" />
                  )}
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
          </ScrollFade>
        </div>
      )}
    </StudioShell>
  );
};
