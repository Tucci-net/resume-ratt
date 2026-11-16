import { getDefaultCareerProfileId } from "@/config/career-profile";
import { SearchStrategyDashboard } from "@/components/features/search-strategy-dashboard";
import { loadSearchStrategy } from "@/lib/search-intelligence/service";

export const dynamic = "force-dynamic";

export default async function SearchStrategyPage() {
  const profileId = getDefaultCareerProfileId();
  if (!profileId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Search Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold">No profile selected</h1>
        <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-400">
          Set the <code>CAREER_PROFILE_ID</code> environment variable to a
          profile ID in the configured Markdown profile repository.
        </p>
      </main>
    );
  }
  const initialStrategy = await loadSearchStrategy(profileId);
  return <SearchStrategyDashboard initialStrategy={initialStrategy} />;
}
