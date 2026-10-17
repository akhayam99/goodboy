import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, useDropdownDirection } from '@goodboy/ui';
import { useToast } from '../../../shared/components/Toast';
import { openUrl } from '../../../shared/lib/editor';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { redactReport } from '../../../shared/utils/redactReport';
import { useAppStore } from '../../../store';
import type { AppState } from '../../../store/types';
import { tauriGhRunner } from '../../integrations/github/github';
import { collectReportContext } from '../../settings/reportContext';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { lastCrashPart } from '../crashReport';
import { LAST_CRASH_TITLE } from '../lastCrash';
import {
  OPEN_REPORT_SHEET_EVENT,
  REPORT_OPEN_MENU_EVENT,
  type OpenReportSheetDetail,
} from '../openReportSheet';
import { contextParts, noticePart, type ReportPart } from '../reportBody';
import type { ReportFiled } from '../reportDestination';
import { reportNames } from '../reportNames';
import { ReportComposer, type ReportDraft, type ReportLinkOpened } from './ReportComposer';

type Opened = {
  readonly key: number;
  readonly heading: string;
  readonly isAnchored: boolean;
};

const REPORT_TRIGGER = '[data-report-bug]';

const SHEET_WIDTH_PX = 560;

const SHEET_EXPECTED_HEIGHT_PX = 260;

const WINDOW_MARGIN_PX = 12;

const visibleTrigger = (): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>(REPORT_TRIGGER)].find(
    (element) => element.getClientRects().length > 0,
  ) ?? null;

type LeadPartsParams = {
  readonly state: AppState;
  readonly detail: OpenReportSheetDetail;
};

const leadParts = ({ state, detail }: LeadPartsParams): ReadonlyArray<ReportPart> => {
  if (detail.crash != null) {
    return [lastCrashPart({ crash: detail.crash })];
  }
  const notice = detail.notice;
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

const headingFor = ({ detail }: { readonly detail: OpenReportSheetDetail }): string => {
  if (detail.crash != null) {
    return detail.crash.kind === 'panic' ? 'Report this crash' : 'Report this error';
  }
  return detail.notice == null ? 'Report a bug' : 'Report this';
};

const NO_PARTS: ReadonlyArray<ReportPart> = [];

const NO_DETAIL: OpenReportSheetDetail = {};

const detailOf = (event: Event): OpenReportSheetDetail =>
  event instanceof CustomEvent && event.detail != null ? event.detail : NO_DETAIL;

const listenToMenu = async (onOpen: () => void): Promise<() => void> => {
  try {
    return await getCurrentWebviewWindow().listen(REPORT_OPEN_MENU_EVENT, onOpen);
  } catch {
    return () => undefined;
  }
};

export const ReportSheetHost = () => {
  const draft = useAppStore((s) => s.bugReportDraft);
  const setBugReportDraft = useAppStore((s) => s.setBugReportDraft);
  const clearBugReportDraft = useAppStore((s) => s.clearBugReportDraft);
  const github = useAppStore((s) => s.githubStatus);
  const refreshGithubStatus = useAppStore((s) => s.refreshGithubStatus);
  const { showToast } = useToast();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [parts, setParts] = useState<ReadonlyArray<ReportPart>>(NO_PARTS);
  const openCount = useRef(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const placement = useDropdownDirection({
    triggerRef,
    popupRef,
    open: opened?.isAnchored === true,
    expectedHeight: SHEET_EXPECTED_HEIGHT_PX,
    expectedWidth: SHEET_WIDTH_PX,
    side: 'right',
    align: 'end',
    shouldMatchTriggerWidth: false,
    viewportMargin: WINDOW_MARGIN_PX,
    maxWidth: SHEET_WIDTH_PX,
  });

  const open = useCallback((detail: OpenReportSheetDetail) => {
    const state = useAppStore.getState();
    const lead = leadParts({ state, detail });
    if (detail.crash != null && state.bugReportDraft.title === '') {
      state.setBugReportDraft({ title: LAST_CRASH_TITLE[detail.crash.kind] });
    }
    setParts(lead);
    triggerRef.current = visibleTrigger();
    const isAnchored = triggerRef.current !== null;
    setOpened((current) => ({
      key: (current?.key ?? 0) + 1,
      heading: headingFor({ detail }),
      isAnchored,
    }));
    openCount.current += 1;
    const openedAs = openCount.current;
    void collectReportContext({ state }).then((context) => {
      if (openCount.current !== openedAs) {
        return;
      }
      setParts([...lead, ...contextParts({ context })]);
    });
  }, []);

  useShortcut('report.open', () => open(NO_DETAIL));

  useEffect(() => {
    const onOpen = (event: Event) => open(detailOf(event));
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, onOpen);
    let unlisten: (() => void) | null = null;
    let isActive = true;
    void listenToMenu(() => open(NO_DETAIL)).then((stop) => {
      if (isActive) {
        unlisten = stop;
        return;
      }
      stop();
    });
    return () => {
      isActive = false;
      window.removeEventListener(OPEN_REPORT_SHEET_EVENT, onOpen);
      unlisten?.();
    };
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
    <div
      className={cn(
        'pointer-events-none fixed z-popover flex',
        opened.isAnchored ? 'inset-0' : 'inset-x-0 bottom-11 justify-center px-4',
      )}
    >
      <div
        ref={popupRef}
        data-report-placement={opened.isAnchored ? 'beside-trigger' : 'centered'}
        style={opened.isAnchored ? placement : undefined}
        className={cn(
          'pointer-events-auto flex w-full max-w-140 min-h-0 flex-col animate-popover-in',
          opened.isAnchored && 'fixed',
        )}
      >
        <ReportComposer
          key={opened.key}
          heading={opened.heading}
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
