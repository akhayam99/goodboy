import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { FirstLapFrame } from '../audit/FirstLapFrame';

export const NoGhPublishScene = () => {
  useEffect(() => {
    useAppStore.setState({
      githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
    });
  }, []);
  return <FirstLapFrame state="publish" />;
};
