import type { DetectedEditor } from '../../shared/lib/editor';

type Params = {
  readonly configured: string;
  readonly detected: ReadonlyArray<DetectedEditor>;
};

export const resolveExploreEditor = ({ configured, detected }: Params): DetectedEditor | null =>
  detected.find((editor) => editor.binary === configured) ?? detected[0] ?? null;
