type Params<Value> = {
  readonly task: () => Promise<Value>;
};

let tail: Promise<void> = Promise.resolve();

const settle = (): void => undefined;

export const enqueuePortWrite = <Value>({ task }: Params<Value>): Promise<Value> => {
  const run = tail.then(task, task);
  tail = run.then(settle, settle);
  return run;
};
