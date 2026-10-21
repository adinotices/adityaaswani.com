// Shared content for the site revamp. Every design variant reads from here so
// the copy stays identical and only the presentation differs.

export const identity = {
  name: "Aditya Aswani",
  // The one-line answer to "who is this?"
  oneLine: "Buddhist, writer, animal rights activist and builder.",
  // A slightly longer version for intros and meta descriptions.
  intro:
    "I meditate, write about animal liberation and mindfulness, and build free tools for practitioners and activists. I'm currently facing felony charges for rescuing dogs from a lab.",
  blessing: "May all beings be happy, healthy, and safe.",
  photo: {
    // Portrait, 2:3. Use srcset with these widths instead of the 4050px original.
    widths: [320, 640, 960],
    src: (w: number) => `/aditya-${w}.webp`,
    width: 4050,
    height: 6000,
    alt: "Aditya Aswani smiling, in a green t-shirt against a dark wooden wall",
  },
};

export type ProductStatus = "live" | "beta" | "coming-soon";

export const statusLabel: Record<ProductStatus, string> = {
  live: "Live",
  beta: "Private beta",
  "coming-soon": "Coming soon",
};

export interface Product {
  slug: string;
  name: string;
  pitch: string;
  status: ProductStatus;
  // Absent when there is nothing public to link to yet.
  url?: string;
  linkLabel: string;
  // Month the product last changed in a way a visitor would notice, "YYYY-MM".
  updated?: string;
  // Screenshot of the live site (taken with Steel on 2026-10-11), 16:10.
  screenshot?: { src640: string; src1280: string; alt: string };
}

export const products: Product[] = [
  {
    slug: "savethedogs",
    name: "SaveTheDogs",
    pitch: "Ridglan has shut down. Now the campaign to free the 16,000 beagles at Marshall BioResources.",
    status: "live",
    url: "https://savethedogs.io",
    linkLabel: "savethedogs.io",
    screenshot: {
      src640: "/products/savethedogs-640.webp",
      src1280: "/products/savethedogs-1280.webp",
      alt: "SaveTheDogs home page: “Now let's get 16,000 beagles out of Marshall.” with a petition form",
    },
  },
  {
    slug: "sutam",
    name: "Sutam",
    pitch:
      "Dharma talks from across the Buddhist traditions, transcribed so you can read along, search, and return to what was said. Now with the Middle Discourses read aloud.",
    status: "live",
    updated: "2026-10",
    url: "https://sutam.org",
    linkLabel: "sutam.org",
    screenshot: {
      src640: "/products/sutam-640.webp",
      src1280: "/products/sutam-1280.webp",
      alt: "Sutam home page: “Thus have I heard.” with a search box for what the teachers said",
    },
  },
  {
    slug: "pausepal",
    name: "PausePal",
    pitch: "Meditate with a buddy every week. Get matched with one partner at times that suit you both, and keep each other showing up.",
    status: "live",
    updated: "2026-10",
    url: "https://pausepal.co",
    linkLabel: "pausepal.co",
    screenshot: {
      src640: "/products/pausepal-640.webp",
      src1280: "/products/pausepal-1280.webp",
      alt: "PausePal home page: “Meditate with a buddy. Every week.”",
    },
  },
  {
    slug: "samvara",
    name: "Samvara",
    pitch:
      "The anti-habit tracker: name the habit you want to stop, put a small stake on staying clean, and pay only if you slip.",
    status: "coming-soon",
    updated: "2026-10",
    linkLabel: "Get notified",
  },
  {
    slug: "amberhall",
    name: "Amberhall",
    pitch:
      "A tabletop adventure run by an AI game master. Friends join from their phones; the story, art and narration play on the big screen.",
    status: "beta",
    updated: "2026-10",
    url: "https://amberhall.quest",
    linkLabel: "amberhall.quest",
    screenshot: {
      src640: "/products/amberhall-640.webp",
      src1280: "/products/amberhall-1280.webp",
      alt: "Amberhall title screen with “I'm hosting” and “I'm playing” buttons over a dusk landscape",
    },
  },
];

export const essaysHome = "https://essays.adityaaswani.com";
export const newsletter = {
  name: "Love Yourself Unconditionally",
  tagline: "Essays on animal liberation and mindfulness, to read or listen to.",
  // Substack's no-JS subscribe endpoint: POST with an `email` field. It must be the custom
  // domain: adityaaswani.substack.com 301s there, which turns the POST into a GET (a 404 in
  // Firefox/Safari) and trips form-action in Chrome (FEATURES.md NEWS-12).
  formAction: "https://essays.adityaaswani.com/api/v1/free?nojs=true",
  url: "https://essays.adityaaswani.com",
};

export interface Essay {
  title: string;
  subtitle: string;
  url: string;
  date: string; // ISO
  cover: string | null; // 800x500 webp; null when a feed post has no image
}

// Latest posts from the Substack archive API, 2026-10-11.
export const essays: Essay[] = [
  {
    title: "I'm Barred From Speaking to at Least 13 Universities",
    subtitle: "My overly broad bail conditions",
    url: "https://essays.adityaaswani.com/p/im-barred-from-speaking-to-at-least",
    date: "2026-06-18",
    cover: "/writing/im-barred-from-speaking-to-at-least.webp",
  },
  {
    title: "The Day the Police Brought Tear Gas to Stop a Dog Rescue",
    subtitle: "My firsthand account of the April 18 rescue attempt",
    url: "https://essays.adityaaswani.com/p/the-day-the-police-brought-tear-gas",
    date: "2026-06-04",
    cover: "/writing/the-day-the-police-brought-tear-gas.webp",
  },
  {
    title: "A Dog Was Taken from My Arms",
    subtitle: "Now I face a felony charge",
    url: "https://essays.adityaaswani.com/p/a-dog-was-taken-from-my-arms",
    date: "2026-03-29",
    cover: "/writing/a-dog-was-taken-from-my-arms.webp",
  },
  {
    title: "Why AI Safety 3: AI Will Misalign",
    subtitle: "Losing control",
    url: "https://essays.adityaaswani.com/p/why-ai-safety-3-ai-will-misalign",
    date: "2025-11-01",
    cover: "/writing/why-ai-safety-3-ai-will-misalign.webp",
  },
  {
    title: "From the Subway to the Sangha",
    subtitle: "Three months in the Buddhist special forces",
    url: "https://essays.adityaaswani.com/p/from-the-subway-to-the-sangha",
    date: "2025-09-17",
    cover: "/writing/from-the-subway-to-the-sangha.webp",
  },
  {
    title: "Why I Try to Be Vegan",
    subtitle: "And why you may want to try too",
    url: "https://essays.adityaaswani.com/p/why-i-try-to-be-vegan",
    date: "2025-08-31",
    cover: "/writing/why-i-try-to-be-vegan.webp",
  },
];

export const meditation = {
  href: "/learn-meditation/",
  blurb:
    "One-on-one meditation guidance on a donation basis, from a Theravada perspective. 50-minute sessions on Zoom, or in person in NYC.",
  bookUrl: "https://cal.com/adityaa",
};

export const nav = [
  { href: "/#building", label: "Building" },
  { href: "/#writing", label: "Writing" },
  { href: "/learn-meditation/", label: "Meditation" },
  { href: "/links/", label: "Links" },
  { href: "/contact/", label: "Contact" },
];

export const support = { href: "/support/", label: "Support my work", short: "Support" };

export const socials = [
  { label: "Substack", href: "https://substack.com/@adinotices" },
  { label: "Instagram", href: "https://www.instagram.com/adinotices" },
  { label: "TikTok", href: "https://tiktok.com/@adinotices" },
  { label: "YouTube", href: "https://youtube.com/@adinotices" },
  { label: "X", href: "https://x.com/adinotices" },
  { label: "Facebook", href: "https://facebook.com/adinotices" },
  { label: "Threads", href: "https://www.threads.net/@adinotices" },
  { label: "Bluesky", href: "https://bsky.app/profile/adinotices.com" },
  { label: "Mastodon", href: "https://veganism.social/@adinotices" },
  { label: "LinkedIn", href: "https://linkedin.com/in/adinotices/" },
  { label: "Spotify", href: "https://open.spotify.com/show/033sCdW3g7BxxzrS14eaoT" },
  { label: "Apple Podcasts", href: "https://podcasts.apple.com/us/podcast/love-yourself-unconditionally-podcast/id1896879700" },
];
