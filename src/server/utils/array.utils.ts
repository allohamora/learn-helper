export const unique = <T>(values: T[]): T[] => {
  return [...new Set(values)];
};

export function* iterateChunks<T>(items: T[], chunkSize: number): Generator<T[]> {
  const totalPages = Math.ceil(items.length / chunkSize);

  for (let page = 1; page <= totalPages; page++) {
    const startIndex = (page - 1) * chunkSize;
    const endIndex = startIndex + chunkSize;

    yield items.slice(startIndex, endIndex);
  }
}

export const toChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];

  for (const chunk of iterateChunks(items, chunkSize)) {
    chunks.push(chunk);
  }

  return chunks;
};
