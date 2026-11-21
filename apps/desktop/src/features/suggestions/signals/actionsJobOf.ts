type Params = {
  readonly detailsUrl: string | null;
};

export type ActionsJob = {
  readonly runId: string;
  readonly jobId: string;
};

const JOB_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/(\d+)\/job\/(\d+)$/;

export const actionsJobOf = ({ detailsUrl }: Params): ActionsJob | null => {
  const match = JOB_URL.exec(detailsUrl ?? '');
  const runId = match?.[1];
  const jobId = match?.[2];
  if (runId === undefined || jobId === undefined) {
    return null;
  }
  return { runId, jobId };
};
