import type { MountId, ProjectId, SessionId } from '@goodboy/types';

export type ReadyCar = Readonly<{
  sessionId: SessionId;
  number: number;
  mountId: MountId;
  projectId: ProjectId | null;
  repo: string;
  branch: string;
  base: string;
  fileCount: number | null;
}>;

export type OrderedCar = Readonly<{
  car: ReadyCar;
  reason: string | null;
}>;

type Params = {
  readonly cars: ReadonlyArray<ReadyCar>;
};

type ParentParams = {
  readonly car: ReadyCar;
  readonly cars: ReadonlyArray<ReadyCar>;
};

const parentOf = ({ car, cars }: ParentParams): ReadyCar | null =>
  cars.find(
    (candidate) =>
      candidate !== car &&
      candidate.projectId !== null &&
      candidate.projectId === car.projectId &&
      candidate.branch === car.base,
  ) ?? null;

type CarParams = {
  readonly car: ReadyCar;
};

const carSizeOf = ({ car }: CarParams): number => car.fileCount ?? Number.MAX_SAFE_INTEGER;

const isSmallest = ({ car, cars }: ParentParams): boolean => {
  const size = car.fileCount;
  if (size === null) {
    return false;
  }
  return cars.every(
    (other) => other === car || (other.fileCount !== null && other.fileCount >= size),
  );
};

const firstReasonOf = ({ car, cars }: ParentParams): string => {
  const children = cars.filter((other) => parentOf({ car: other, cars }) === car);
  const parts = [
    ...(isSmallest({ car, cars }) ? ['smallest'] : []),
    ...children.map((child) => `#${child.number} builds on it`),
  ];
  return parts.length === 0 ? 'First: waiting longest' : `First: ${parts.join(', and ')}`;
};

export const mergeOrderOf = ({ cars }: Params): ReadonlyArray<OrderedCar> => {
  const remaining = [...cars];
  const ordered: Array<ReadyCar> = [];
  while (remaining.length > 0) {
    const free = remaining.filter((car) => {
      const parent = parentOf({ car, cars });
      return parent === null || !remaining.includes(parent);
    });
    const pool = free.length > 0 ? free : remaining;
    const next = pool.reduce((best, car) =>
      carSizeOf({ car }) < carSizeOf({ car: best }) ? car : best,
    );
    ordered.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return ordered.map((car, index) => {
    if (index === 0) {
      return { car, reason: cars.length > 1 ? firstReasonOf({ car, cars }) : null };
    }
    const parent = parentOf({ car, cars });
    return { car, reason: parent === null ? null : `After #${parent.number}, which it builds on` };
  });
};
