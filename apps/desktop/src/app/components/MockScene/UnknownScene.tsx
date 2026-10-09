import { MOCK_SCENES } from './registry';

type Props = {
  readonly sceneName: string;
};

type PrefixParams = {
  readonly id: string;
  readonly sceneName: string;
};

const prefixLength = ({ id, sceneName }: PrefixParams): number => {
  let count = 0;
  while (count < id.length && count < sceneName.length && id[count] === sceneName[count]) {
    count += 1;
  }
  return count;
};

export const UnknownScene = ({ sceneName }: Props) => {
  const nearest = Object.keys(MOCK_SCENES)
    .sort(
      (left, right) =>
        prefixLength({ id: right, sceneName }) - prefixLength({ id: left, sceneName }) ||
        left.localeCompare(right),
    )
    .slice(0, 3);
  return (
    <section role="alert" className="flex flex-col gap-3 p-6">
      <h1 className="text-heading">Unknown scene "{sceneName}"</h1>
      <p className="text-prose">Try one of these scenes:</p>
      <ul className="flex flex-col gap-1">
        {nearest.map((id) => (
          <li key={id}>
            <a href={`?scene=${id}`} className="text-primary hover:underline">
              {id}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
