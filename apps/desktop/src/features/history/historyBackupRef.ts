const BACKUP_PREFIX = 'refs/goodboy/backup';

type RefParams = {
  readonly branch: string;
  readonly atMs: number;
};

export const historyBackupRef = ({ branch, atMs }: RefParams): string => {
  const encoded = [...new TextEncoder().encode(branch)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${BACKUP_PREFIX}/b-${encoded}/${Math.floor(atMs)}000000`;
};

export const historyBackupTimeMs = ({ ref }: { readonly ref: string }): number | null => {
  const stamp = ref.slice(ref.lastIndexOf('/') + 1);
  if (!/^\d{7,}$/.test(stamp)) {
    return null;
  }
  return Number(stamp.slice(0, -6));
};
