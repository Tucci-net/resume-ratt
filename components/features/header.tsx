import Link from "next/link";
import { BrandLogo } from "@/components/features/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200/40 px-6 py-4 dark:border-neutral-700/40">
      <div className="flex items-center gap-8">
        <Link href="/" aria-label="Resume Ratt home" className="flex min-w-0 items-center">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-neutral-600 dark:text-neutral-400 sm:flex">
          <Link href="/" className="hover:text-black dark:hover:text-white">
            Home
          </Link>
          <Link
            href="/dashboard"
            className="hover:text-black dark:hover:text-white"
          >
            Career profile
          </Link>
          <Link
            href="/resume"
            className="hover:text-black dark:hover:text-white"
          >
            Resume builder
          </Link>
          <Link
            href="/login"
            className="hover:text-black dark:hover:text-white"
          >
            Log in
          </Link>
        </nav>
      </div>
      <ThemeToggle />
    </header>
  );
}
