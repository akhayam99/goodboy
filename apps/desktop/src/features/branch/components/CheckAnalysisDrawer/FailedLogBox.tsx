import { failedLogsOf } from '../../checks/failedLogsOf';
import { DrawerBox } from './DrawerBox';
import { LogEntry } from './LogEntry';

type Props = {
  readonly text: string | null;
};

export const FailedLogBox = ({ text }: Props) => {
  const logs = text === null ? [] : failedLogsOf({ text });
  return (
    <DrawerBox label="Failed log tail">
      {logs.length === 0 ? (
        <p className="text-body text-muted-foreground">Not readable here</p>
      ) : (
        logs.map((log, index) => <LogEntry key={`${index}-${log.name}`} log={log} />)
      )}
    </DrawerBox>
  );
};
