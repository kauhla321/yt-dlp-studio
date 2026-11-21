// The author's links, shown in the top bar and on the Settings → about card.
// To add one, append an entry: { kind: "linkedin" | "website", label, url }.

export type SocialKind = "github" | "linkedin" | "website";

export interface SocialLink {
  kind: SocialKind;
  /** Short accessible name, e.g. "github". */
  label: string;
  url: string;
}

export const SOCIALS: SocialLink[] = [
  { kind: "github", label: "github", url: "https://github.com/kauhla321" },
  { kind: "linkedin", label: "linkedin", url: "https://www.linkedin.com/in/christian-jesus-b-alcazar/" },
  { kind: "website", label: "portfolio", url: "https://christianjesusbalcazar.netlify.app/" },
];
