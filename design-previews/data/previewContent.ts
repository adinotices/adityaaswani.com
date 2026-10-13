// Content for the design variants in design-previews/pages/. It is derived from the live site's
// data (src/data/site.ts and the Substack feed), so a rebuild with scripts/build-design-previews.mjs
// always shows the current products and essays and only the presentation differs.
import { products, meditation, essays, type Essay } from "./site";

export interface Project {
  number: string;
  title: string;
  description: string;
  link: string;
}

export interface Post {
  date: string;
  title: string;
  description: string;
  link: string;
}

export const projects: Project[] = [
  ...products.map((p) => ({ title: p.name, description: p.pitch, link: p.url ?? "/#building" })),
  { title: "One-on-One Meditation Guidance", description: meditation.blurb, link: meditation.href },
].map((p, i) => ({ number: String(i + 1).padStart(2, "0"), ...p }));

// Same source as the home page: the generated feed when the build fetched it, else site.ts.
const [generated] = Object.values(
  import.meta.glob<{ essays: Essay[] }>("./essays.generated.json", { eager: true, import: "default" }),
);
const latest = (generated?.essays ?? essays).slice(0, 3);

// "Mar. 29 ’26", the style the variants were designed around. Essay dates are YYYY-MM-DD.
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month}. ${d.getUTCDate()} ’${String(d.getUTCFullYear()).slice(2)}`;
};

export const posts: Post[] = latest.map((e) => ({
  date: shortDate(e.date),
  title: e.title,
  description: e.subtitle,
  link: e.url,
}));

export const heroLinks = {
  essay: latest[0].url,
  petition: "https://savethedogs.io",
  substack: "https://essays.adityaaswani.com",
  // The CSP integration allows this embed host (and its redirect target) on the pages that use it.
  substackEmbed: "https://adityaaswani.substack.com/embed",
};
