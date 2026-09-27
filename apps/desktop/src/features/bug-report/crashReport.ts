import { redactReport } from '../../shared/utils/redactReport';
import { useAppStore } from '../../store';
import {
  buildReportContext,
  collectReportContext,
  type ReportContext,
} from '../settings/reportContext';
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

export const collectCrashContext = async (): Promise<ReportContext> => {
  try {
    return await collectReportContext({ state: useAppStore.getState() });
  } catch {
    return buildReportContext({ version: null, platform: null, locationKey: '', providers: [] });
  }
};
