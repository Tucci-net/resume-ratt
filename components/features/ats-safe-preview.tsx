"use client";

import { AccordionSection } from "@/components/features/accordion-section";
import type { ResumeContent, ResumeSectionConfig } from "@/lib/resume/model";
import {
  generateAtsPlainText,
  validateAtsSafeV1,
} from "@/lib/resume/ats-safe";

export function AtsSafePreview({
  resume,
  sections,
}: {
  resume: ResumeContent;
  sections: ResumeSectionConfig[];
}) {
  const findings = validateAtsSafeV1(resume, sections);
  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warning");

  return (
    <section
      className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
      aria-label="ATS Safe v1 preview and checks"
    >
      <AccordionSection
        title={<span className="text-lg font-semibold">ATS Safe v1</span>}
        description="Plain-text reading order and explainable checks. This is guidance, not a compatibility guarantee."
      >
        <div className="space-y-5 pt-5">
          <div
            aria-live="polite"
            className="space-y-2"
            aria-label="ATS resume findings"
          >
            {findings
              .filter((finding) => finding.severity !== "pass")
              .map((finding, index) => (
                <p
                  key={`${finding.ruleId}-${finding.path ?? index}`}
                  className={`rounded-md px-3 py-2 text-sm ${
                    finding.severity === "error"
                      ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                      : "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  }`}
                >
                  <span className="font-semibold">
                    {finding.severity === "error" ? "Error: " : "Review: "}
                  </span>
                  {finding.message}
                </p>
              ))}
            {errors.length === 0 && warnings.length === 0 && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                No issues were found by these checks.
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Plain-text preview</h3>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              {generateAtsPlainText(resume, sections) ||
                "Add resume content to preview its plain-text reading order."}
            </pre>
          </div>
        </div>
      </AccordionSection>
    </section>
  );
}
