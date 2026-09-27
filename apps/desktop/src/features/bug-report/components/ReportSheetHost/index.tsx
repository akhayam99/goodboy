import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../../app/components/Toast';
import { openUrl } from '../../../../shared/lib/editor';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { redactReport } from '../../../../shared/utils/redactReport';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { tauriGhRunner } from '../../../github/github';
import { collectReportContext } from '../../../settings/reportContext';
import {
  OPEN_REPORT_SHEET_EVENT,
  type OpenReportSheetDetail,
  type ReportNotice,
} from '../../openReportSheet';
import { contextParts, noticePart, type ReportPart } from '../../reportBody';
import type { ReportFiled } from '../../reportDestination';
import { reportNames } from '../../reportNames';
import { ReportComposer, type ReportDraft, type ReportLinkOpened } from '../ReportComposer';

type Opened = {
  readonly key: number;
  readonly notice: ReportNotice | null;
};

type NoticePartsParams = {
  readonly state: AppState;
  readonly notice: ReportNotice | null;
};

const noticeParts = ({ state, notice }: NoticePartsParams): ReadonlyArray<ReportPart> => {
  if (notice == null) {
    return [];
  }
  const names = reportNames({ workspaces: state.workspaces, projects: state.projects });
  return [
    noticePart({
      title: redactReport({ text: notice.title, names }),
      body: redactReport({ text: notice.body, names }),
    }),
  ];
};

const NO_PARTS: ReadonlyArray<ReportPart> = [];

const isOpenDetail = (event: Event): event is CustomEvent<OpenReportSheetDetail | null> =>
  event instanceof CustomEvent;

export const ReportSheetHost = () => {
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);
  const github = useAppStore((s) => s.githubStatus);
  const refreshGithubStatus = useAppStore((s) => s.refreshGithubStatus);
  const { showToast } = useToast();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [parts, setParts] = useState<ReadonlyArray<ReportPart>>(NO_PARTS);

  const open = useCallback((notice: ReportNotice | null) => {
    const state = useAppStore.getState();
    const lead = noticeParts({ state, notice });
    setParts(lead);
    setOpened((current) => ({ key: (current?.key ?? 0) + 1, notice }));
    void collectReportContext({ state }).then((context) => {
      setParts([...lead, ...contextParts({ context })]);
    });
  }, []);

  useShortcut('report.open', () => open(null));

  useEffect(() => {
    const onOpen = (event: Event) => {
      open(isOpenDetail(event) ? (event.detail?.notice ?? null) : null);
    };
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REPORT_SHEET_EVENT, onOpen);
  }, [open]);

  useEffect(() => {
    if (opened == null || github != null) {
      return;
    }
    void refreshGithubStatus();
  }, [opened, github, refreshGithubStatus]);

  const close = useCallback(() => setOpened(null), []);

  const onFiled = useCallback(
    (filed: ReportFiled) => {
      setOpened(null);
      const where = filed.number == null ? 'on GitHub' : `#${filed.number}`;
      const url = filed.url;
      showToast({
        kind: 'success',
        title: filed.kind === 'comment' ? `Added to ${where}` : `Issue ${where} filed`,
        message:
          github?.user == null ? 'On GitHub, under your account.' : `On GitHub as @${github.user}.`,
        action:
          url == null
            ? undefined
            : {
                label: filed.kind === 'comment' ? 'View comment' : 'View issue',
                onClick: () => void openUrl(url),
              },
      });
    },
    [github?.user, showToast],
  );

  const onOpenedLink = useCallback(
    ({ overflows }: ReportLinkOpened) => {
      setOpened(null);
      showToast({
        kind: 'info',
        title: 'Finish on GitHub',
        message: overflows
          ? 'The rest did not fit the link and is on your clipboard. Paste it into the issue, then submit.'
          : 'Submit the form in your browser to file the issue.',
      });
    },
    [showToast],
  );

  const onDraftChange = useCallback(
    (patch: Partial<ReportDraft>) => setBugReportDraft(patch),
    [setBugReportDraft],
  );

  if (opened == null) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-11 z-popover flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-140 animate-popover-in">
        <ReportComposer
          key={opened.key}
          heading={opened.notice == null ? 'Report a bug' : 'Report this'}
          variant="floating"
          parts={parts}
          draft={draft}
          onDraftChange={onDraftChange}
          onDraftClear={clearBugReportDraft}
          github={github}
          runner={tauriGhRunner}
          hasTypeControl
          linePlaceholder="What went wrong, in one line"
          onClose={close}
          onFiled={onFiled}
          onOpenedLink={onOpenedLink}
        />
      </div>
    </div>
  );
};
