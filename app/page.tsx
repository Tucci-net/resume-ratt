import Link from "next/link";
import { Header } from "@/components/features/header";
import { Module } from "@/components/features/module";

const FEATURES = [
  {
    title: "Write it once",
    description:
      "Keep your experience, projects, skills, and accomplishments together instead of digging them up for every application.",
  },
  {
    title: "Make it fit the job",
    description:
      "Build a focused resume from the experience you already have without starting from scratch.",
  },
  {
    title: "Send it with confidence",
    description:
      "Keep the format clean, readable, and ATS-conscious, then export it when you're ready.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="mx-auto flex min-h-[65vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400">
          Applying for jobs already sucks enough.
          </p>

          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
          Job hunting is a rat race. Your resume shouldn&apos;t be.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-400">
          I got tired of rebuilding the same resume for every application,
  digging through old experience, and wondering if an ATS would even
  read it. So I built Resume Ratt to make the whole thing a little
  less painful.
</p>
          <Link
            href="/dashboard"
            className="mt-8 rounded-md bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Build your resume
          </Link>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Module key={feature.title}>
              <h2 className="text-lg font-medium">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {feature.description}
              </p>
            </Module>
          ))}
        </section>
      </main>
    </div>
  );
}
