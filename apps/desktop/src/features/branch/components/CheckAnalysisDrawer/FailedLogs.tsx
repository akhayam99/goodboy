import { failedLogsOf } from '../../checks/failedLogsOf';
import { LogEntry } from './LogEntry';

type Props = {
  readonly text: string | null;
};

export const FailedLogs = ({ text }: Props) => {
  const logs = text === null ? [] : failedLogsOf({ text });
  if (logs.length === 0) {
    return <p className="text-body text-muted-foreground">Not readable here</p>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {logs.map((log, index) => (
        <LogEntry key={`${index}-${log.name}`} log={log} />
      ))}
    </div>
  );
};
