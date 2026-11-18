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

export function reconcileCareerLibraryItems(
  existing: CareerLibraryItem[],
  incoming: CareerLibraryItem[],
  now = new Date().toISOString(),
): {
  items: CareerLibraryItem[];
  added: number;
  updated: number;
  skipped: number;
  conflicts: number;
} {
  const items = [...existing];
  const indexById = new Map(items.map((item, index) => [item.id, index]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const imported of incoming) {
    const index = indexById.get(imported.id);
    if (index === undefined) {
      indexById.set(imported.id, items.length);
      items.push(imported);
      added += 1;
      continue;
    }

    const current = items[index]!;
    if (current.updatedAt !== imported.updatedAt) {
      conflicts += 1;
      continue;
    }

    if (sameCareerLibraryContent(current, imported)) {
      skipped += 1;
      continue;
    }

    items[index] = {
      ...imported,
      createdAt: current.createdAt,
      updatedAt: now,
      ...(current.canonicalText !== imported.canonicalText ||
      current.type !== imported.type
        ? { canonicalRevisionId: createRevisionId() }
        : {
            canonicalRevisionId:
              current.canonicalRevisionId ?? current.updatedAt,
          }),
    };
    updated += 1;
  }

  return { items, added, updated, skipped, conflicts };
}

function createRevisionId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `revision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameCareerLibraryContent(
  left: CareerLibraryItem,
  right: CareerLibraryItem,
): boolean {
  return (
    left.type === right.type &&
    left.canonicalText === right.canonicalText &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
    JSON.stringify(left.skills) === JSON.stringify(right.skills) &&
    JSON.stringify(left.metrics) === JSON.stringify(right.metrics) &&
    Boolean(left.restricted) === Boolean(right.restricted) &&
    JSON.stringify(left.variants ?? []) === JSON.stringify(right.variants ?? []) &&
    left.source === right.source &&
    left.verificationStatus === right.verificationStatus
  );
}
