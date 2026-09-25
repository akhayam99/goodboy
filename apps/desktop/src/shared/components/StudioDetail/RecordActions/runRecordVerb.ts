import type { RecordVerb } from './types';

type Params = {
  readonly verb: RecordVerb;
  readonly onArm: (key: string) => void;
};

export const runRecordVerb = ({ verb, onArm }: Params): void => {
  if (verb.blockedReason != null || verb.isBusy) {
    return;
  }
  if (verb.confirm != null) {
    onArm(verb.key);
    return;
  }
  void verb.onRun();
};
