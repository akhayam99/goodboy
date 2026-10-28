import type { ErrorReportRequest } from '@goodboy/ui';
import { invokeCommand } from '../../shared/lib/invokeCommand';

const writeRenderCrash = async ({ error, componentStack }: ErrorReportRequest): Promise<void> => {
  try {
    await invokeCommand('log_render_crash', {
      name: error.name,
      message: error.message,
      stack: error.stack ?? '',
      componentStack: componentStack ?? '',
    });
  } catch {
    return;
  }
};

export const logRenderCrash = ({ error, componentStack }: ErrorReportRequest): void => {
  void writeRenderCrash({ error, componentStack });
};
