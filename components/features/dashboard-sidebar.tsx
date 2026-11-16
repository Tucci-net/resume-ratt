"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, FileText, Search } from "lucide-react";
import { BrandLogo } from "@/components/features/brand-logo";

export function DashboardSidebar() {
  const pathname = usePathname();
  const isCareerProfile = pathname === "/dashboard";
  const isSearchStrategy = pathname === "/search-strategy";
  const isResumeBuilder = pathname === "/resume";

  return (
    <aside className="dashboard-sidebar hidden w-64 flex-col border-r border-neutral-200 bg-white px-4 py-6 dark:border-neutral-800 dark:bg-neutral-950 lg:flex">
      <Link
        href="/"
        aria-label="Resume Ratt home"
        className="mb-8 flex min-h-10 items-center px-2"
      >
        <BrandLogo className="sm:h-8" />
      </Link>

      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Workspace
      </p>
      <nav>
        <Link
          href="/dashboard"
          aria-current={isCareerProfile ? "page" : undefined}
          className={`mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
            isCareerProfile
              ? "bg-neutral-100 font-medium dark:bg-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }`}
        >
          <BriefcaseBusiness className="h-4 w-4" />
          Career profile
        </Link>
        <Link
          href="/search-strategy"
          aria-current={isSearchStrategy ? "page" : undefined}
          className={`mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
            isSearchStrategy
              ? "bg-neutral-100 font-medium dark:bg-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }`}
        >
          <Search className="h-4 w-4" />
          Search strategy
        </Link>
        <Link
          href="/resume"
          aria-current={isResumeBuilder ? "page" : undefined}
          className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
            isResumeBuilder
              ? "bg-neutral-100 font-medium dark:bg-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }`}
        >
          <FileText className="h-4 w-4" />
          Resume builder
        </Link>
      </nav>
    </aside>
  );
}