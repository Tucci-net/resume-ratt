import { CareerProfileDashboard } from "@/components/features/career-profile-dashboard";
import { getDefaultCareerProfileId } from "@/config/career-profile";
import { loadSearchStrategy } from "@/lib/search-intelligence/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profileId = getDefaultCareerProfileId();
  if (!profileId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Career profile
        </p>
        <h1 className="mt-2 text-3xl font-semibold">No profile selected</h1>
        <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">
          Set the <code>CAREER_PROFILE_ID</code> environment variable to a
          profile ID in the configured Markdown profile repository. In local
          development, the Tanner seed profile is selected automatically.
        </p>
      </main>
    );
  }

  const strategy = await loadSearchStrategy(profileId);
  return (
    <CareerProfileDashboard
      initialDocument={{
        profile: strategy.careerProfile,
        revision: strategy.careerProfileRevision,
      }}
      searchStrategySummary={{
        approvedTermCount: strategy.searchProfile.terms.filter(
          (term) => term.status === "seed" || term.status === "approved",
        ).length,
        proposedTermCount: strategy.searchProfile.terms.filter(
          (term) => term.status === "proposed",
        ).length,
        providerRecommendationCount:
          strategy.providerRecommendations.filter(
            (recommendation) => recommendation.status === "recommended",
          ).length,
        queryCount: strategy.plan.queries.length,
        queryPreview: strategy.plan.queries.slice(0, 2).map((query) => ({
          rationale: query.rationale,
          terms: query.terms,
        })),
      }}
    />
  );
}
