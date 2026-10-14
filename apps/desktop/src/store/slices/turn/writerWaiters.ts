type Waiter = () => void;

type WaitParams = Readonly<{ ms: number }>;

const createWriterWaiters = () => {
  const waiters = new Set<Waiter>();
  const wait = ({ ms }: WaitParams): Promise<void> =>
    new Promise<void>((resolve) => {
      const wake: Waiter = () => {
        clearTimeout(timer);
        waiters.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, ms);
      waiters.add(wake);
    });
  const wake = (): void => {
    for (const waiter of Array.from(waiters)) {
      waiter();
    }
  };
  return { wait, wake };
};

export const writerWaiters = createWriterWaiters();
