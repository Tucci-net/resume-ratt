"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseCareerLibraryJson,
  serializeCareerLibraryJson,
} from "@/lib/career-library/format";
import type { CareerLibraryItem } from "@/lib/resume/model";

export const CAREER_LIBRARY_STORAGE_KEY = "resume-ratt:career-library";

export function useCareerLibrary() {
  const [items, setItems] = useState<CareerLibraryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CAREER_LIBRARY_STORAGE_KEY);
      setItems(saved ? parseCareerLibraryJson(saved) : []);
    } catch (loadError) {
      setRecoveryRequired(true);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Career Library storage is malformed. Existing data was preserved.",
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || recoveryRequired) return;
    try {
      window.localStorage.setItem(
        CAREER_LIBRARY_STORAGE_KEY,
        serializeCareerLibraryJson(items),
      );
      setError("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Career Library changes could not be saved in this browser.",
      );
    }
  }, [items, isLoaded, recoveryRequired]);

  const updateItems = useCallback(
    (update: (current: CareerLibraryItem[]) => CareerLibraryItem[]) => {
      setItems((current) => update(current));
    },
    [],
  );

  const startFreshAfterRecovery = useCallback(() => {
    setItems([]);
    setError("");
    setRecoveryRequired(false);
  }, []);

  return {
    items,
    isLoaded,
    recoveryRequired,
    error,
    setError,
    updateItems,
    startFreshAfterRecovery,
  };
}
