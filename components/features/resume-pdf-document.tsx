import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
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
import { selectResumePresentation } from "@/lib/resume/export";

const PAGE_MARGIN = 43.2;
const PDF_METADATA_DATE = new Date("2000-01-01T00:00:00.000Z");
const styles = StyleSheet.create({
  page: {
    padding: PAGE_MARGIN,
    color: "#171717",
    backgroundColor: "#ffffff",
  },
  header: {
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#171717",
    marginBottom: 8,
  },
  name: { fontWeight: 700, lineHeight: 1.15 },
  headline: { marginTop: 4, color: "#525252", fontSize: 11 },
  contact: { marginTop: 8, color: "#525252", fontSize: 8.5, lineHeight: 1.35 },
  section: { marginTop: 16 },
  sectionTitle: {
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 0.6,
    borderBottomColor: "#a3a3a3",
    color: "#404040",
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  entry: { marginBottom: 8 },
  entryHeading: { fontWeight: 700, lineHeight: 1.25 },
  secondary: { color: "#525252", marginTop: 2 },
  detail: { color: "#525252", marginTop: 2 },
  paragraph: { lineHeight: 1.4 },
  bullet: { marginLeft: 12, paddingLeft: 2, lineHeight: 1.35 },
  link: { color: "#1d4ed8", textDecoration: "underline" },
});

export function ResumePdfDocument({
  resume,
  sections,
  design,
}: {
  resume: ResumeContent;
  sections: ResumeSectionConfig[];
  design: ResumeDesignSettings;
}) {
  const fontFamily = isSerif(design.fontFamily) ? "Times-Roman" : "Helvetica";
  const presentation = selectResumePresentation(resume, sections);
  const documentStyle = {
    fontFamily,
    fontSize: design.bodyFontSize * 0.75,
    lineHeight: design.lineHeight,
  };
  const visibleSections = sections.filter(
    (section) =>
      section.visible && hasResumeSectionContent(resume, section.id),
  );

  return (
    <Document
      title={resume.name || "Resume"}
      author={resume.name || undefined}
      creationDate={PDF_METADATA_DATE}
      modificationDate={PDF_METADATA_DATE}
    >
      <Page size="LETTER" style={[styles.page, documentStyle]}>
        <View style={styles.header}>
          <Text
            style={[
              styles.name,
              { fontSize: design.bodyFontSize * 0.75 * design.headingScale },
            ]}
          >
            {resume.name || "Your Name"}
          </Text>
          {resume.headline.trim() && (
            <Text style={styles.headline}>{resume.headline.trim()}</Text>
          )}
          {contactDetails(resume).length > 0 && (
            <View style={styles.contact}>
              {contactDetails(resume).map((detail) =>
                detail.url ? (
                  <Link key={detail.label} src={detail.url} style={styles.link}>
                    {detail.label}
                  </Link>
                ) : (
                  <Text key={detail.label}>{detail.label}</Text>
                ),
              )}
            </View>
          )}
        </View>
        {visibleSections.map((section) => (
          <View
            key={section.id}
            style={[styles.section, { marginTop: design.sectionSpacing * 0.75 }]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: design.bodyFontSize * 0.75 * design.headingScale * 0.55 },
              ]}
            >
              {RESUME_SECTION_LABELS[section.id]}
            </Text>
            <SectionEntries
              content={presentation}
              sectionId={section.id}
            />
          </View>
        ))}
      </Page>
    </Document>
  );
}

function SectionEntries({
  content,
  sectionId,
}: {
  content: ResumeContent;
  sectionId: ResumeSectionId;
}) {
  switch (sectionId) {
    case "summary":
      return <Text style={styles.paragraph}>{content.summary.trim()}</Text>;
    case "experience":
      return (
        <View>
          {content.experience.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.entryHeading}>
                {join([entry.jobTitle, entry.employer], " · ")}
              </Text>
              <Text style={styles.detail}>
                {join(
                  [
                    entry.location,
                    join(
                      [
                        entry.startDate,
                        entry.currentRole ? "Present" : entry.endDate,
                      ],
                      " – ",
                    ),
                  ],
                  " · ",
                )}
              </Text>
              {entry.accomplishments.map((item, index) => (
                <Text key={`${entry.id}-${index}`} style={styles.bullet}>
                  • {item}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "education":
      return (
        <View>
          {content.education.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.entryHeading}>{entry.institution}</Text>
              <Text style={styles.secondary}>
                {join([entry.degree, entry.fieldOfStudy], ", ")}
              </Text>
              <Text style={styles.detail}>
                {join(
                  [
                    entry.location,
                    join(
                      [
                        entry.startDate,
                        entry.currentlyEnrolled
                          ? entry.endDate
                            ? `Expected ${entry.endDate}`
                            : "Currently enrolled"
                          : entry.endDate,
                      ],
                      " – ",
                    ),
                    entry.gpa ? `GPA ${entry.gpa}` : "",
                    entry.honors,
                  ],
                  " · ",
                )}
              </Text>
            </View>
          ))}
        </View>
      );
    case "projects":
      return (
        <View>
          {content.projects.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.entryHeading}>
                {join([entry.name, entry.subtitle], " · ")}
              </Text>
              <Text style={styles.detail}>
                {join([entry.startDate, entry.endDate], " – ")}
              </Text>
              {entry.url.trim() && (
                <ExternalLink value={entry.url} />
              )}
              {entry.description.trim() && (
                <Text style={styles.paragraph}>{entry.description.trim()}</Text>
              )}
              {entry.accomplishments.map((item, index) => (
                <Text key={`${entry.id}-${index}`} style={styles.bullet}>
                  • {item}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case "skills":
      return (
        <Text style={styles.paragraph}>
          {splitResumeItems(content.skills).join(" · ")}
        </Text>
      );
    case "certifications":
      return (
        <View>
          {content.certifications.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.entryHeading}>{entry.name}</Text>
              <Text style={styles.detail}>
                {join(
                  [
                    entry.issuer,
                    entry.issueDate,
                    entry.expirationDate
                      ? `Expires ${entry.expirationDate}`
                      : "",
                    entry.credentialId ? `ID ${entry.credentialId}` : "",
                  ],
                  " · ",
                )}
              </Text>
              {entry.credentialUrl.trim() && (
                <ExternalLink value={entry.credentialUrl} />
              )}
            </View>
          ))}
        </View>
      );
  }
}

function contactDetails(
  resume: ResumeContent,
): Array<{ label: string; url?: string }> {
  const details: Array<{ label: string; url?: string }> = [];
  for (const value of [
    resume.email,
    resume.phone,
    resume.location,
  ]) {
    if (value.trim()) details.push({ label: value.trim() });
  }
  if (resume.website.trim()) {
    details.push({
      label: resume.website.trim(),
      url: webUrl(resume.website) ?? undefined,
    });
  }
  return details;
}

function isSerif(fontFamily: string): boolean {
  return ["merriweather", "libre-baskerville", "eb-garamond"].includes(
    fontFamily,
  );
}

function webUrl(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function ExternalLink({ value }: { value: string }) {
  const url = webUrl(value);
  return url ? (
    <Link src={url} style={styles.link}>
      {value.trim()}
    </Link>
  ) : (
    <Text>{value.trim()}</Text>
  );
}

function join(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator);
}
