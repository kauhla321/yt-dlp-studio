import { GithubIcon, GlobeIcon, LinkedInIcon } from "./ui/icons";
import { SOCIALS, type SocialKind } from "@/lib/socials";

const ICONS: Record<SocialKind, typeof GithubIcon> = {
  github: GithubIcon,
  linkedin: LinkedInIcon,
  website: GlobeIcon,
};

/** Labeled pill links for the author's socials (home screen intro). */
export function SocialPills() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {SOCIALS.map((s) => {
        const Icon = ICONS[s.kind];
        return (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={s.url.replace(/^https?:\/\//, "")}
            className="flex items-center gap-2 rounded-full border border-[#232323] bg-surface px-3.5 py-1.5 text-xs text-ink-muted no-underline transition-colors duration-150 hover:border-[#3a3a3a] hover:text-ink"
          >
            <Icon className="h-3.5 w-3.5" />
            {s.label}
          </a>
        );
      })}
    </div>
  );
}
