import { useCallback } from 'react';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';
import { TasksStage } from '../u25/c12/TasksStage';
import { LEDGER_RECORD, WORKSPACE_TASKS } from '../u25/c12/tasksSeed';

const ARRIVALS = WORKSPACE_TASKS.filter((record) => record.provider === 'github').slice(0, 2);

const ARRIVAL_KEYS: ReadonlySet<string> = new Set(ARRIVALS.map((record) => record.key));

export const TasksNewScene = () => {
  const seed = useCallback(() => {
    useAppStore.setState({
      taskNewKeys: { [WORKSPACE_ID]: ARRIVALS.map((record) => record.key) },
    });
  }, []);
  return (
    <TasksStage
      records={WORKSPACE_TASKS}
      scope="for-me"
      groupBy="source"
      starredKeys={[LEDGER_RECORD.key]}
      cursorKey={LEDGER_RECORD.key}
      newKeys={ARRIVAL_KEYS}
      onSeed={seed}
    />
  );
};
