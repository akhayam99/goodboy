import { useEffect, useState } from 'react';

type Params = {
  readonly blob: Blob;
};

export const useObjectUrl = ({ blob }: Params): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [blob]);

  return url;
};
