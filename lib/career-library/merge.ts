import type { CareerLibraryItem } from "@/lib/resume/model";

export function mergeCareerLibraryItems(
  existing: CareerLibraryItem[],
  incoming: CareerLibraryItem[],
): {
  items: CareerLibraryItem[];
  added: number;
  skipped: number;
} {
  const ids = new Set(existing.map((item) => item.id));
  const items = [...existing];
  let added = 0;
  let skipped = 0;

  for (const item of incoming) {
    if (ids.has(item.id)) {
      skipped += 1;
      continue;
    }
    ids.add(item.id);
    items.push(item);
    added += 1;
  }

  return { items, added, skipped };
}
