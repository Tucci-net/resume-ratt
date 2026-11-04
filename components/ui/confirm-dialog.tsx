"use client";

import { useEffect, useId, useRef, useState } from "react";

const CLOSE_ANIMATION_MS = 200;

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">(
    "closed",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open) {
      setActionError("");
      setIsProcessing(false);
      if (!dialog.open) dialog.showModal();
      setPhase("opening");
      cancelButtonRef.current?.focus();
      const animationFrame = window.requestAnimationFrame(() =>
        setPhase("open"),
      );
      return () => window.cancelAnimationFrame(animationFrame);
    }

    if (!dialog.open) {
      setPhase("closed");
      return;
    }

    setPhase("closing");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      setPhase("closed");
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      dialog.close();
      closeTimerRef.current = null;
      setPhase("closed");
    }, CLOSE_ANIMATION_MS);

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  async function confirmAction() {
    if (isProcessing) return;
    setIsProcessing(true);
    setActionError("");
    try {
      await onConfirm();
      onCancel();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The action could not be completed. Please try again.",
      );
      setIsProcessing(false);
    }
  }

  function dismiss() {
    if (!isProcessing) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-phase={phase}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          dialogRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="resume-confirm-dialog"
    >
      <div className="resume-confirm-dialog-panel">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300"
        >
          {description}
        </p>
        {actionError && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          >
            {actionError}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isProcessing}
            onClick={dismiss}
            className="resume-confirm-dialog-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={confirmAction}
            className={
              destructive
                ? "resume-confirm-dialog-destructive"
                : "resume-confirm-dialog-primary"
            }
          >
            {isProcessing ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
