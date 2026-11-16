type PastedData = {
  readonly files: FileList | ReadonlyArray<File>;
  readonly items?: DataTransferItemList | ReadonlyArray<DataTransferItem>;
};

type Params = {
  readonly data: PastedData;
};

export const pastedFilesOf = ({ data }: Params): ReadonlyArray<File> => {
  const files = Array.from(data.files);
  if (files.length > 0 || data.items === undefined) {
    return files;
  }
  return Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
};
