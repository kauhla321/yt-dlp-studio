import { GithubIcon, GlobeIcon, LinkedInIcon } from "./ui/icons";
import { SOCIALS, type SocialKind } from "@/lib/socials";

const ICONS: Record<SocialKind, typeof GithubIcon> = {
  github: GithubIcon,
  linkedin: LinkedInIcon,
  website: GlobeIcon,
};

/** Round icon buttons for the author's links (open in the system browser). */
export function SocialIcons() {
  return (
    <div className="flex items-center gap-1.5">
      {SOCIALS.map((s) => {
        const Icon = ICONS[s.kind];
        return (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            aria-label={s.label}
            title={s.url.replace(/^https?:\/\//, "")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted no-underline transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <Icon className="h-[15px] w-[15px]" />
          </a>
        );
      })}
    </div>
  );
}
