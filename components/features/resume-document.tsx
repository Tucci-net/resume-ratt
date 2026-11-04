"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  ResumeContent,
  ResumeDesignSettings,
  ResumeSectionConfig,
  ResumeSectionId,
} from "@/lib/resume/model";
import {
  hasResumeSectionContent,
  RESUME_SECTION_LABELS,
} from "@/lib/resume/sections";
import { splitResumeItems } from "@/lib/resume/format";
import { paginateResumeBlocks } from "@/lib/resume/pagination";

const LETTER_WIDTH_PX = 8.5 * 96;
const LETTER_HEIGHT_PX = 11 * 96;
const PAGE_MARGIN_PX = 0.6 * 96;
const PAGE_GAP_PX = 24;
const USABLE_PAGE_HEIGHT = LETTER_HEIGHT_PX - PAGE_MARGIN_PX * 2;

type DocumentBlock = {
  id: string;
  node: ReactNode;
};

export function ResumeDocument({
  resume,
  sections,
  design,
  fontFamily,
}: {
  resume: ResumeContent;
  sections: ResumeSectionConfig[];
  design: ResumeDesignSettings;
  fontFamily: string;
}) {
  const blocks = useMemo(
    () => createDocumentBlocks(resume, sections, design.headingScale),
    [resume, sections, design.headingScale],
  );
  const [pagePlan, setPagePlan] = useState(() => ({
    pages: [blocks.map((_, index) => index)],
    overflowingBlocks: [] as number[],
  }));
  const [scale, setScale] = useState(1);
  const measurementRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = measurementRef.current;
    if (!root) return;

    const measure = () => {
      if (getComputedStyle(root).display === "none") return;

      const heights = Array.from(root.children).map(
        (child) => child.getBoundingClientRect().height,
      );
      const next = paginateResumeBlocks(heights, USABLE_PAGE_HEIGHT);
      setPagePlan((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [
    blocks,
    design.bodyFontSize,
    design.headingScale,
    design.lineHeight,
    design.sectionSpacing,
    fontFamily,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setScale(Math.min(1, entry.contentRect.width / LETTER_WIDTH_PX));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const documentStyle: CSSProperties & {
    "--resume-section-spacing": string;
  } = {
    fontFamily,
    fontSize: `${design.bodyFontSize}pt`,
    lineHeight: design.lineHeight,
    "--resume-section-spacing": `${design.sectionSpacing}px`,
  };
  const pageCount = Math.max(1, pagePlan.pages.length);
  const scaledPageHeight =
    (pageCount * LETTER_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX) * scale;
  const scaledPageWidth = LETTER_WIDTH_PX * scale;

  return (
    <section className="resume-print-area" aria-label="Live resume preview">
      <div className="resume-page-status" aria-live="polite">
        <p className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {pageCount} Letter {pageCount === 1 ? "page" : "pages"}
        </p>
        {pagePlan.overflowingBlocks.length > 0 && (
          <p
            role="status"
            className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Some content blocks are taller than one printable page and may
            split in the PDF.
          </p>
        )}
        {pageCount > 1 && (
          <p className="sr-only">
            Resume content continues onto page {pageCount}.
          </p>
        )}
      </div>
      <div
        ref={viewportRef}
        className="resume-page-viewport"
      >
        <div
          className="resume-page-frame"
          style={{
            height: `${scaledPageHeight}px`,
            width: `${scaledPageWidth}px`,
          }}
        >
          <div
            className="resume-page-stack"
            style={{
              width: `${LETTER_WIDTH_PX}px`,
              transform: `scale(${scale})`,
            }}
          >
            {pagePlan.pages.map((page, pageIndex) => (
              <article
                key={`page-${pageIndex}`}
                className="resume-paper-page rounded-sm bg-white text-neutral-900 shadow-xl shadow-neutral-900/10"
                style={documentStyle}
                aria-label={`Resume page ${pageIndex + 1} of ${pageCount}`}
              >
                {page.map((blockIndex) => (
                  <div
                    key={blocks[blockIndex]?.id}
                    className="resume-page-block"
                  >
                    {blocks[blockIndex]?.node}
                  </div>
                ))}
                <span className="resume-page-number" aria-hidden="true">
                  {pageIndex + 1}
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={measurementRef}
        className="resume-page-measurement"
        style={documentStyle}
        aria-hidden="true"
        inert
      >
        {blocks.map((block) => (
          <div key={block.id} className="resume-page-block">
            {block.node}
          </div>
        ))}
      </div>
    </section>
  );
}

function createDocumentBlocks(
  resume: ResumeContent,
  sections: ResumeSectionConfig[],
  headingScale: number,
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [
    {
      id: "resume-header",
      node: <ResumeHeader resume={resume} headingScale={headingScale} />,
    },
  ];

  for (const section of sections) {
    if (!section.visible || !hasResumeSectionContent(resume, section.id)) {
      continue;
    }
    blocks.push(...createSectionBlocks(section.id, resume, headingScale));
  }

  if (blocks.length === 1) {
    blocks.push({
      id: "empty-resume",
      node: (
        <p className="resume-content-section text-neutral-400">
          Add content and show a section to start building your resume.
        </p>
      ),
    });
  }
  return blocks;
}

function ResumeHeader({
  resume,
  headingScale,
}: {
  resume: ResumeContent;
  headingScale: number;
}) {
  const contactDetails = [
    resume.email,
    resume.phone,
    resume.location,
    resume.website,
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <header className="resume-document-header border-b-2 border-neutral-900 pb-[1.2em]">
      <h2
        className="break-words font-bold tracking-tight"
        style={{ fontSize: `${headingScale}em` }}
      >
        {resume.name || "Your Name"}
      </h2>
      {resume.headline.trim() && (
        <p className="mt-1 text-neutral-600" style={{ fontSize: "1.2em" }}>
          {resume.headline.trim()}
        </p>
      )}
      {contactDetails.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-neutral-600">
          {contactDetails.map((detail) => (
            <span key={detail} style={{ fontSize: "0.85em" }}>
              {detail}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

function createSectionBlocks(
  sectionId: ResumeSectionId,
  resume: ResumeContent,
  headingScale: number,
): DocumentBlock[] {
  const title = RESUME_SECTION_LABELS[sectionId];
  const heading = (
    <h2
      className="resume-section-heading mb-2 border-b border-neutral-300 pb-1 font-bold uppercase tracking-[0.16em] text-neutral-700"
      style={{ fontSize: `${headingScale * 0.55}em` }}
    >
      {title}
    </h2>
  );
  const entryNodes = getEntryNodes(sectionId, resume);

  return entryNodes.map((entry, index) => ({
    id: `${sectionId}-${index}`,
    node: (
      <section
        className={`resume-document-section${index === 0 ? " resume-content-section" : ""}`}
      >
        {index === 0 && heading}
        {entry}
      </section>
    ),
  }));
}

function getEntryNodes(
  sectionId: ResumeSectionId,
  resume: ResumeContent,
): ReactNode[] {
  switch (sectionId) {
    case "summary":
      return [
        <p key="summary" className="whitespace-pre-line text-neutral-700">
          {resume.summary.trim()}
        </p>,
      ];
    case "experience":
      return resume.experience
        .filter((item) =>
          hasResumeSectionContent(
            { ...resume, experience: [item] },
            "experience",
          ),
        )
        .map((item) => {
          const heading = joinNonEmpty([item.jobTitle, item.employer], " · ");
          const dates = joinNonEmpty(
            [item.startDate, item.currentRole ? "Present" : item.endDate],
            " – ",
          );
          const bullets = item.accomplishments
            .map((bullet) => bullet.trim())
            .filter(Boolean);

          return (
            <div key={item.id} className="resume-entry">
              {(heading || dates || item.location.trim()) && (
                <div className="resume-entry-heading">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    {heading && (
                      <h3
                        className="font-semibold"
                        style={{ fontSize: "1.05em" }}
                      >
                        {heading}
                      </h3>
                    )}
                    {dates && (
                      <span className="text-neutral-600" style={{ fontSize: "0.85em" }}>
                        {dates}
                      </span>
                    )}
                  </div>
                  {item.location.trim() && (
                    <p className="text-neutral-600" style={{ fontSize: "0.9em" }}>
                      {item.location.trim()}
                    </p>
                  )}
                </div>
              )}
              {bullets.length > 0 && <BulletList items={bullets} />}
            </div>
          );
        });
    case "education":
      return resume.education
        .filter((item) =>
          hasResumeSectionContent(
            { ...resume, education: [item] },
            "education",
          ),
        )
        .map((item) => {
          const dates = joinNonEmpty(
            [
              item.startDate,
              item.currentlyEnrolled
                ? item.endDate
                  ? `Expected ${item.endDate}`
                  : "Currently enrolled"
                : item.endDate,
            ],
            " – ",
          );
          const details = joinNonEmpty(
            [
              item.location,
              item.gpa ? `GPA ${item.gpa}` : "",
              item.honors,
            ],
            " · ",
          );
          const degree = joinNonEmpty(
            [item.degree, item.fieldOfStudy],
            ", ",
          );

          return (
            <div key={item.id} className="resume-entry">
              {(item.institution.trim() || dates || degree || details) && (
                <div className="resume-entry-heading">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    {item.institution.trim() && (
                      <h3 className="font-semibold">
                        {item.institution.trim()}
                      </h3>
                    )}
                    {dates && (
                      <span className="text-neutral-600" style={{ fontSize: "0.85em" }}>
                        {dates}
                      </span>
                    )}
                  </div>
                  {degree && <p>{degree}</p>}
                  {details && (
                    <p className="text-neutral-600" style={{ fontSize: "0.9em" }}>
                      {details}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        });
    case "projects":
      return resume.projects
        .filter((item) =>
          hasResumeSectionContent({ ...resume, projects: [item] }, "projects"),
        )
        .map((item) => {
          const dates = joinNonEmpty(
            [item.startDate, item.endDate],
            " – ",
          );
          const url = toExternalUrl(item.url);
          const bullets = item.accomplishments
            .map((bullet) => bullet.trim())
            .filter(Boolean);

          return (
            <div key={item.id} className="resume-entry">
              {(item.name.trim() ||
                item.subtitle.trim() ||
                dates ||
                url) && (
                <div className="resume-entry-heading">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {item.name.trim() && (
                        <h3 className="font-semibold">{item.name.trim()}</h3>
                      )}
                      {item.subtitle.trim() && (
                        <span className="text-neutral-600">
                          {item.subtitle.trim()}
                        </span>
                      )}
                    </div>
                    {dates && (
                      <span className="text-neutral-600" style={{ fontSize: "0.85em" }}>
                        {dates}
                      </span>
                    )}
                  </div>
                  {url && (
                    <a
                      href={url}
                      className="break-all text-blue-800 underline"
                      style={{ fontSize: "0.9em" }}
                    >
                      {item.url.trim()}
                    </a>
                  )}
                </div>
              )}
              {item.description.trim() && (
                <p className="whitespace-pre-line text-neutral-700">
                  {item.description.trim()}
                </p>
              )}
              {bullets.length > 0 && <BulletList items={bullets} />}
            </div>
          );
        });
    case "skills":
      return [
        <p key="skills" className="text-neutral-700">
          {splitResumeItems(resume.skills).join(" · ")}
        </p>,
      ];
    case "certifications":
      return resume.certifications
        .filter((item) =>
          hasResumeSectionContent(
            { ...resume, certifications: [item] },
            "certifications",
          ),
        )
        .map((item) => {
          const dates = joinNonEmpty(
            [
              item.issueDate,
              item.expirationDate ? `Expires ${item.expirationDate}` : "",
            ],
            " · ",
          );
          const url = toExternalUrl(item.credentialUrl);
          const metadata = joinNonEmpty(
            [
              item.issuer,
              dates,
              item.credentialId ? `ID ${item.credentialId}` : "",
            ],
            " · ",
          );

          return (
            <div key={item.id} className="resume-entry">
              {item.name.trim() && (
                <p className="font-semibold">{item.name.trim()}</p>
              )}
              {metadata && (
                <p className="text-neutral-600" style={{ fontSize: "0.9em" }}>
                  {metadata}
                </p>
              )}
              {url && (
                <a
                  href={url}
                  className="break-all text-blue-800 underline"
                  style={{ fontSize: "0.9em" }}
                >
                  {item.credentialUrl.trim()}
                </a>
              )}
            </div>
          );
        });
  }
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-neutral-700">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}

function joinNonEmpty(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator);
}

function toExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
