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
  {
    number: "01",
    title: "Animal Rights Activism",
    description:
      "Taking nonviolent direct action to free the dogs at Ridglan Farms — and facing a felony charge for it.",
    link: "https://savethedogs.io",
  },
  {
    number: "02",
    title: "Contemplative Semester",
    description:
      "A three-month immersion in meditation, community living and earth connection for young adults.",
    link: "https://www.contemplativesemester.org/",
  },
  {
    number: "03",
    title: "PausePal",
    description: "Find your meditation accountability buddy.",
    link: "https://pausepal.co/",
  },
  {
    number: "04",
    title: "Brooklyn Insight Sangha",
    description: "Website for our local meditation community.",
    link: "https://bkinsight.nyc/",
  },
  {
    number: "05",
    title: "One-on-One Meditation Guidance",
    description: "Get personalized meditation guidance on a donation basis.",
    link: "/learn-meditation/",
  },
];

export const posts: Post[] = [
  {
    date: "Mar. 29 ’26",
    title: "A Dog was Taken from My Arms",
    description: "Now I face a felony charge.",
    link: "https://adityaaswani.substack.com/p/a-dog-was-taken-from-my-arms",
  },
  {
    date: "Nov. 1 ’25",
    title: "Why AI Safety — 3: AI will Misalign",
    description: "Losing Control.",
    link: "https://adityaaswani.substack.com/p/why-ai-safety-3-ai-will-misalign",
  },
  {
    date: "Sep. 17 ’25",
    title: "From the Subway to the Sangha",
    description: "Three months in the Buddhist Special Forces.",
    link: "https://adityaaswani.substack.com/p/from-the-subway-to-the-sangha",
  },
];

export const heroLinks = {
  essay:
    "https://adityaaswani.substack.com/p/a-dog-was-taken-from-my-arms",
  petition: "https://savethedogs.io",
  substack: "https://adityaaswani.substack.com",
  substackEmbed: "https://adityaaswani.substack.com/embed",
};
