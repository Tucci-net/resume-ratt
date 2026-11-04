export type ResumePagePlan = {
  pages: number[][];
  overflowingBlocks: number[];
};

export function paginateResumeBlocks(
  blockHeights: number[],
  usablePageHeight: number,
): ResumePagePlan {
  if (!Number.isFinite(usablePageHeight) || usablePageHeight <= 0) {
    throw new Error("Usable page height must be a positive number.");
  }
  if (blockHeights.some((height) => !Number.isFinite(height) || height < 0)) {
    throw new Error("Resume block heights must be finite, non-negative numbers.");
  }

  const pages: number[][] = [[]];
  const overflowingBlocks: number[] = [];
  let usedHeight = 0;

  blockHeights.forEach((height, index) => {
    if (height > usablePageHeight) {
      if (pages[pages.length - 1]!.length > 0) pages.push([]);
      pages[pages.length - 1]!.push(index);
      overflowingBlocks.push(index);
      pages.push([]);
      usedHeight = 0;
      return;
    }

    if (usedHeight > 0 && usedHeight + height > usablePageHeight) {
      pages.push([]);
      usedHeight = 0;
    }
    pages[pages.length - 1]!.push(index);
    usedHeight += height;
  });

  while (pages.length > 1 && pages[pages.length - 1]!.length === 0) {
    pages.pop();
  }
  return { pages: pages.length === 0 ? [[]] : pages, overflowingBlocks };
}
