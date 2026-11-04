import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  const imageClassName = `h-8 w-auto max-w-full object-contain sm:h-9 ${className}`;

  return (
    <span className="inline-flex max-w-full items-center">
      <Image
        src="/resume-ratt-day.png"
        alt="Resume Ratt — Indie Contractor Tools"
        width={497}
        height={94}
        className={`${imageClassName} dark:hidden`}
      />
      <Image
        src="/resume-ratt-nighty.png"
        alt="Resume Ratt — Indie Contractor Tools"
        width={497}
        height={94}
        className={`${imageClassName} hidden dark:block`}
      />
    </span>
  );
}
