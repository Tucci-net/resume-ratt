export type ResumeExperience = {
  id: string;
  employer: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  currentRole: boolean;
  accomplishments: string[];
};

export type ResumeEducation = {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location: string;
  startDate: string;
  endDate: string;
  currentlyEnrolled: boolean;
  gpa: string;
  honors: string;
};

export type ResumeProject = {
  id: string;
  name: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  url: string;
  description: string;
  accomplishments: string[];
};

export type ResumeCertification = {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate: string;
  credentialId: string;
  credentialUrl: string;
};

export type CareerLibraryItemType =
  | "accomplishment"
  | "project"
  | "skill"
  | "summary"
  | "education"
  | "certification";

export type CareerLibraryVerificationStatus =
  | "unverified"
  | "self-verified"
  | "verified";

export type CareerLibraryItem = {
  id: string;
  type: CareerLibraryItemType;
  canonicalText: string;
  tags: string[];
  skills: string[];
  metrics: string[];
  source?: string;
  verificationStatus: CareerLibraryVerificationStatus;
  createdAt: string;
  updatedAt: string;
};

export type CareerLibraryDocument = {
  version: 1;
  items: CareerLibraryItem[];
};

export type ResumeLibraryReference = {
  libraryItemId: string;
  type: CareerLibraryItemType;
  section: ResumeSectionId;
  relationship: "copy" | "reference";
  resumeText: string;
};

export type ResumeContent = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  skills: string;
  certifications: ResumeCertification[];
  careerLibraryReferences: ResumeLibraryReference[];
};

export type ResumeSectionId =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certifications";

export type ResumeSectionConfig = {
  id: ResumeSectionId;
  visible: boolean;
};

export type ResumeDesignSettings = {
  fontFamily: string;
  bodyFontSize: number;
  headingScale: number;
  lineHeight: number;
  sectionSpacing: number;
};

export type ResumeFontOption = {
  id: string;
  name: string;
  category: "Sans serif" | "Serif";
  cssFamily: string;
  fontFaceFamily: string;
  googleFontsUrl: string;
};

export const INITIAL_RESUME: ResumeContent = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  summary: "",
  experience: [],
  education: [],
  projects: [],
  skills: "",
  certifications: [],
  careerLibraryReferences: [],
};

export const DEFAULT_RESUME_SECTIONS: ResumeSectionConfig[] = [
  { id: "summary", visible: true },
  { id: "experience", visible: true },
  { id: "education", visible: true },
  { id: "projects", visible: true },
  { id: "skills", visible: true },
  { id: "certifications", visible: true },
];

export const DEFAULT_RESUME_DESIGN: ResumeDesignSettings = {
  fontFamily: "inter",
  bodyFontSize: 10,
  headingScale: 2,
  lineHeight: 1.4,
  sectionSpacing: 18,
};

export const RESUME_FONTS: ResumeFontOption[] = [
  {
    id: "inter",
    name: "Inter",
    category: "Sans serif",
    cssFamily: '"Inter", Arial, sans-serif',
    fontFaceFamily: "Inter",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  {
    id: "roboto",
    name: "Roboto",
    category: "Sans serif",
    cssFamily: '"Roboto", Arial, sans-serif',
    fontFaceFamily: "Roboto",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  },
  {
    id: "open-sans",
    name: "Open Sans",
    category: "Sans serif",
    cssFamily: '"Open Sans", Arial, sans-serif',
    fontFaceFamily: "Open Sans",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap",
  },
  {
    id: "source-sans-3",
    name: "Source Sans 3",
    category: "Sans serif",
    cssFamily: '"Source Sans 3", Arial, sans-serif',
    fontFaceFamily: "Source Sans 3",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap",
  },
  {
    id: "lato",
    name: "Lato",
    category: "Sans serif",
    cssFamily: '"Lato", Arial, sans-serif',
    fontFaceFamily: "Lato",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  },
  {
    id: "merriweather",
    name: "Merriweather",
    category: "Serif",
    cssFamily: '"Merriweather", Georgia, serif',
    fontFaceFamily: "Merriweather",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  },
  {
    id: "libre-baskerville",
    name: "Libre Baskerville",
    category: "Serif",
    cssFamily: '"Libre Baskerville", Georgia, serif',
    fontFaceFamily: "Libre Baskerville",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap",
  },
  {
    id: "eb-garamond",
    name: "EB Garamond",
    category: "Serif",
    cssFamily: '"EB Garamond", Georgia, serif',
    fontFaceFamily: "EB Garamond",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap",
  },
];
