"use client";

import { useCallback, useEffect, useState } from "react";
import type { SetStateAction } from "react";
import {
  createInitialResumeDraftStore,
  createResumeDraft,
  parseResumeDraftStore,
  RESUME_DRAFT_STORAGE_KEY,
  serializeResumeDraftStore,
} from "@/lib/resume/persistence";
import { createResumeSnapshot } from "@/lib/resume/lifecycle";
import type {
  ResumeDraft,
  ResumeDraftStore,
} from "@/lib/resume/persistence";
import type {
  ResumeContent,
  ResumeDesignSettings,
  ResumeSectionConfig,
} from "@/lib/resume/model";
import type { CareerLibraryItem } from "@/lib/resume/model";

export type DraftSaveStatus = "loading" | "saved" | "saving" | "error";

export function useResumeDrafts() {
  const [store, setStore] = useState<ResumeDraftStore>(
    createInitialResumeDraftStore,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState<DraftSaveStatus>("loading");

  const commitStore = useCallback((next: ResumeDraftStore) => {
    setStore(next);
  }, []);

  const saveNow = useCallback(() => {
    if (!isLoaded || recoveryRequired) return false;
    setStatus("saving");
    try {
      window.localStorage.setItem(
        RESUME_DRAFT_STORAGE_KEY,
        serializeResumeDraftStore(store),
      );
      setSaveError("");
      setStatus("saved");
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Your changes could not be saved in this browser.";
      setSaveError(message);
      setStatus("error");
      return false;
    }
  }, [isLoaded, recoveryRequired, store]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RESUME_DRAFT_STORAGE_KEY);
      if (raw === null) {
        commitStore(createInitialResumeDraftStore());
      } else {
        const parsed = parseResumeDraftStore(raw);
        commitStore(parsed.store);
        setWarnings(parsed.warnings);
        if (parsed.migrated || parsed.warnings.length > 0) {
          setStatus("saving");
        } else {
          setStatus("saved");
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Draft storage is unavailable in this browser.";
      setRecoveryError(message);
      setRecoveryRequired(true);
      commitStore(createInitialResumeDraftStore());
      setStatus("error");
    } finally {
      setIsLoaded(true);
    }
  }, [commitStore]);

  useEffect(() => {
    if (!isLoaded || recoveryRequired || !store) return;

    const timer = window.setTimeout(() => {
      setStatus("saving");
      try {
        window.localStorage.setItem(
          RESUME_DRAFT_STORAGE_KEY,
          serializeResumeDraftStore(store),
        );
        setSaveError("");
        setStatus("saved");
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Your changes could not be saved in this browser.",
        );
        setStatus("error");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isLoaded, recoveryRequired, store]);

  const updateActiveDraft = useCallback(
    (update: (draft: ResumeDraft) => ResumeDraft) => {
      setStore((current) => {
        const nextDrafts = current.drafts.map((draft) => {
          if (draft.id !== current.activeDraftId) return draft;
          const updatedAt = new Date().toISOString();
          return {
            ...update({ ...draft, updatedAt }),
            updatedAt,
            revision: draft.revision + 1,
          };
        });
        const next = { ...current, drafts: nextDrafts };
        return next;
      });
    },
    [],
  );

  const updateDrafts = useCallback(
    (update: (drafts: ResumeDraft[]) => ResumeDraft[]) => {
      setStore((current) => ({
        ...current,
        drafts: update(current.drafts),
      }));
    },
    [],
  );

  const submitActiveDraft = useCallback(
    (targetApplicationId: string, items: CareerLibraryItem[]) => {
      const active = store.drafts.find(
        (draft) => draft.id === store.activeDraftId,
      );
      if (!active) throw new Error("No working draft is available to submit.");
      const snapshot = createResumeSnapshot(
        active,
        items,
        targetApplicationId,
      );
      if (store.snapshots.some((entry) => entry.id === snapshot.id)) {
        throw new Error("A submitted snapshot with this ID already exists.");
      }
      setStore((current) => ({
        ...current,
        snapshots: [...current.snapshots, snapshot],
      }));
      return snapshot;
    },
    [store],
  );

  const setResume = useCallback(
    (action: SetStateAction<ResumeContent>) => {
      updateActiveDraft((draft) => ({
        ...draft,
        resume:
          typeof action === "function" ? action(draft.resume) : action,
      }));
    },
    [updateActiveDraft],
  );

  const setDesign = useCallback(
    (action: SetStateAction<ResumeDesignSettings>) => {
      updateActiveDraft((draft) => ({
        ...draft,
        design:
          typeof action === "function" ? action(draft.design) : action,
      }));
    },
    [updateActiveDraft],
  );

  const setSections = useCallback(
    (sections: ResumeSectionConfig[]) => {
      updateActiveDraft((draft) => ({ ...draft, sections }));
    },
    [updateActiveDraft],
  );

  const selectDraft = useCallback((id: string) => {
    setStore((current) => {
      if (!current.drafts.some((draft) => draft.id === id)) return current;
      const next = { ...current, activeDraftId: id };
      return next;
    });
  }, []);

  const createDraft = useCallback((name = "Untitled resume") => {
    setStore((current) => {
      const draft = createResumeDraft(name);
      const next = {
        ...current,
        activeDraftId: draft.id,
        drafts: [...current.drafts, draft],
      };
      return next;
    });
  }, []);

  const duplicateActiveDraft = useCallback(() => {
    setStore((current) => {
      const original = current.drafts.find(
        (draft) => draft.id === current.activeDraftId,
      );
      if (!original) return current;
      const duplicate: ResumeDraft = {
        ...structuredClone(original),
        id: crypto.randomUUID(),
        name: `${original.name} copy`.slice(0, 100),
        updatedAt: new Date().toISOString(),
        revision: 1,
      };
      const next = {
        ...current,
        activeDraftId: duplicate.id,
        drafts: [...current.drafts, duplicate],
      };
      return next;
    });
  }, []);

  const renameActiveDraft = useCallback(
    (name: string) => {
      const normalized = name.trim();
      if (!normalized || normalized.length > 100) return false;
      updateActiveDraft((draft) => ({ ...draft, name: normalized }));
      return true;
    },
    [updateActiveDraft],
  );

  const deleteActiveDraft = useCallback(() => {
    setStore((current) => {
      const remaining = current.drafts.filter(
        (draft) => draft.id !== current.activeDraftId,
      );
      if (remaining.length === 0) remaining.push(createResumeDraft());
      const next = {
        ...current,
        activeDraftId: remaining[0]!.id,
        drafts: remaining,
      };
      return next;
    });
  }, []);

  const startFreshAfterRecovery = useCallback(() => {
    const fresh = createInitialResumeDraftStore();
    setRecoveryRequired(false);
    setRecoveryError("");
    setWarnings([]);
    setSaveError("");
    commitStore(fresh);
  }, [commitStore]);

  const activeDraft =
    store.drafts.find((draft) => draft.id === store.activeDraftId) ?? null;

  return {
    store,
    activeDraft,
    isLoaded,
    recoveryRequired,
    recoveryError,
    warnings,
    saveError,
    status,
    saveNow,
    setResume,
    setDesign,
    setSections,
    updateActiveDraft,
    updateDrafts,
    submitActiveDraft,
    selectDraft,
    createDraft,
    duplicateActiveDraft,
    renameActiveDraft,
    deleteActiveDraft,
    startFreshAfterRecovery,
  };
}
