import { isActionName, recentActions, recordScreen } from '../../shared/utils/actionRing';
import { redactReport } from '../../shared/utils/redactReport';
import { useAppStore } from '../../store';
import {
  buildReportContext,
  collectReportContext,
  type ReportContext,
} from '../settings/reportContext';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { locationKey } from '../../store/slices/navigation/locationKey';
import { screenLabel } from '../settings/reportContext/screenLabel';
import { writeLastCrash, type LastCrash, type LastCrashInput } from './lastCrash';
import { errorPart, trimStack, type ReportPart } from './reportBody';
import { reportNames } from './reportNames';

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

type CrashKindParams = {
  readonly error: Error;
};

export const crashKind = ({ error }: CrashKindParams): string =>
  ERROR_NAME.test(error.name) ? error.name : 'runtime error';

const knownNames = (): ReadonlyArray<string> => {
  try {
    const state = useAppStore.getState();
    return reportNames({ workspaces: state.workspaces, projects: state.projects });
  } catch {
    return [];
  }
};

type CrashPartParams = {
  readonly message: string;
  readonly stack: string | null | undefined;
  readonly componentStack: string | null | undefined;
};

export const crashPart = ({ message, stack, componentStack }: CrashPartParams): ReportPart => {
  const names = knownNames();
  const clean = (text: string) => redactReport({ text, names });
  return errorPart({
    message: clean(message),
    stack: clean(trimStack({ stack })),
    componentStack: clean(trimStack({ stack: componentStack })),
  });
};

export const describeCrash = (error: Error): string =>
  redactReport({ text: error.message, names: knownNames() });

const currentScreen = (): string | null => {
  try {
    const location = captureLocation({ state: useAppStore.getState() });
    return screenLabel({
      locationKey: locationKey({ place: location.place, studio: location.studio }),
    });
  } catch {
    return null;
  }
};

const BENIGN_ERROR = /ResizeObserver loop/;

let isCaptured = false;
const MAX_REJECTION_REASONS = 3;
let pendingRejections: Array<{ readonly message: string; readonly stack?: string }> = [];
let isRejectionFlushQueued = false;

type CaptureParams = {
  readonly source: LastCrashInput['source'];
  readonly message: string;
  readonly stack: string | null | undefined;
};

export const captureCrash = ({ source, message, stack }: CaptureParams): void => {
  if (isCaptured || BENIGN_ERROR.test(message)) {
    return;
  }
  isCaptured = true;
  const names = knownNames();
  const clean = (text: string) => redactReport({ text, names });
  void writeLastCrash({
    source,
    message: clean(message),
    stack: clean(trimStack({ stack })),
    screen: currentScreen(),
    actions: recentActions().filter((name) => isActionName({ name })),
  });
};

const followScreens = (): void => {
  let last: string | null = null;
  const note = () => {
    const screen = currentScreen();
    if (screen == null || screen === last) {
      return;
    }
    last = screen;
    recordScreen({ label: screen });
  };
  note();
  useAppStore.subscribe((state, previous) => {
    const moved =
      state.currentSessionId !== previous.currentSessionId ||
      state.appStudio !== previous.appStudio ||
      state.activeLens !== previous.activeLens ||
      state.sessionStudio !== previous.sessionStudio ||
      state.openSessionDraftWorkspaceId !== previous.openSessionDraftWorkspaceId;
    if (moved) {
      note();
    }
  });
};

type ReasonParams = {
  readonly reason: unknown;
};

const describeRejectedObject = ({ reason }: ReasonParams): string | null => {
  if (typeof reason !== 'object' || reason === null) {
    return null;
  }
  const message: unknown = Reflect.get(reason, 'message');
  if (typeof message === 'string' && message !== '') {
    const kind: unknown = Reflect.get(reason, 'kind');
    return typeof kind === 'string' && kind !== '' ? `${kind}: ${message}` : message;
  }
  try {
    const serialized = JSON.stringify(reason);
    return serialized === undefined || serialized === '{}' ? null : serialized;
  } catch {
    return null;
  }
};

const describeReason = ({
  reason,
}: ReasonParams): { readonly message: string; readonly stack?: string } => {
  if (reason instanceof Error) {
    return { message: `${reason.name}: ${reason.message}`, stack: reason.stack };
  }
  if (typeof reason === 'string') {
    return { message: reason };
  }
  return { message: describeRejectedObject({ reason }) ?? 'Unhandled rejection' };
};

const flushRejectedReasons = (): void => {
  isRejectionFlushQueued = false;
  const rejected = pendingRejections;
  pendingRejections = [];
  if (rejected.length === 0) {
    return;
  }
  const message =
    rejected.length === 1
      ? (rejected[0]?.message ?? 'Unhandled rejection')
      : rejected.map((entry, index) => `${index + 1}. ${entry.message}`).join('\n');
  captureCrash({ source: 'promise', message, stack: rejected[0]?.stack });
};

const captureRejectedReason = ({ reason }: ReasonParams): void => {
  if (isCaptured) {
    return;
  }
  if (pendingRejections.length < MAX_REJECTION_REASONS) {
    pendingRejections.push(describeReason({ reason }));
  }
  if (isRejectionFlushQueued) {
    return;
  }
  isRejectionFlushQueued = true;
  queueMicrotask(flushRejectedReasons);
};

export const installCrashCapture = (): void => {
  followScreens();
  window.addEventListener('error', (event) => {
    const described =
      event.error == null ? { message: event.message } : describeReason({ reason: event.error });
    captureCrash({ source: 'window', message: described.message, stack: described.stack });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureRejectedReason({ reason: event.reason });
  });
};

type LastCrashPartParams = {
  readonly crash: LastCrash;
};

export const lastCrashPart = ({ crash }: LastCrashPartParams): ReportPart => {
  const names = knownNames();
  const clean = (text: string) => redactReport({ text, names });
  const where = crash.screen == null ? '' : `, on ${clean(crash.screen)}`;
  const actions =
    crash.actions.length === 0 ? '' : `\nLast actions: ${crash.actions.slice(0, 10).join(', ')}`;
  return errorPart({
    message: `${clean(crash.message)}\nIn ${clean(crash.appVersion)}${where}${actions}`,
    stack: clean(crash.stack),
    componentStack: '',
  });
};

export const collectCrashContext = async (): Promise<ReportContext> => {
  try {
    return await collectReportContext({ state: useAppStore.getState() });
  } catch {
    return buildReportContext({ version: null, platform: null, locationKey: '', providers: [] });
  }
};
