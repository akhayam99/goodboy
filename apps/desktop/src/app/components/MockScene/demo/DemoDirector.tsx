import { useSceneDirector } from './director/useSceneDirector';

type Props = {
  readonly sceneName: string;
};

export const DemoDirector = ({ sceneName }: Props) => {
  useSceneDirector({ sceneName });
  return null;
};
