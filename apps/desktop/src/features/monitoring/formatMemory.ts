type Params = {
  readonly bytes: number;
};

const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;

export const formatMemory = ({ bytes }: Params): string => {
  if (bytes >= GIB) {
    return `${(bytes / GIB).toFixed(1)} GB`;
  }
  if (bytes >= MIB) {
    return `${Math.round(bytes / MIB)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / KIB))} KB`;
};
