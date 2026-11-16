import path from "node:path";
import { MarkdownCareerProfileRepository } from "@/lib/career-profile/repository";
import { CareerProfileService } from "@/lib/career-profile/service";

export const careerProfileService = new CareerProfileService(
  new MarkdownCareerProfileRepository(
    process.env.CAREER_PROFILE_DIRECTORY ??
      path.join(process.cwd(), "profiles"),
  ),
);
