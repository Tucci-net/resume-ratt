"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function AccordionSection({
  title,
  description,
  defaultOpen = false,
  className = "",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const titleId = useId();

  return (
    <section className={className}>
      <h2 className="m-0">
        <button
          type="button"
          id={titleId}
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((open) => !open)}
          className="resume-disclosure-trigger"
        >
          <span className="min-w-0 flex-1 text-left">
            {title}
            {description && (
              <span className="mt-1 block text-sm font-normal text-neutral-500 dark:text-neutral-400">
                {description}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`resume-disclosure-chevron${isOpen ? " is-open" : ""}`}
          />
        </button>
      </h2>
      <div
        id={contentId}
        role="region"
        aria-labelledby={titleId}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`resume-accordion-panel${isOpen ? " is-open" : ""}`}
      >
        <div className="resume-accordion-panel-inner">{children}</div>
      </div>
    </section>
  );
}
