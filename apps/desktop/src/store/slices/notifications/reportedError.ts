export class ReportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportedError';
  }
}

export const isReportedError = (error: unknown): boolean => error instanceof ReportedError;
