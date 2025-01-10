import type { Metadata } from "next";

export const siteConfig: Metadata = {
  title: "Numera",
  description: "Your numbers, now.",
  keywords: [
    "finance",
    "accounting",
    "bookkeeping",
    "money",
    "budget",
    "tracker",
    "platform",
    "app",
    "saas"
  ],
  authors: {
    name: "Aleksandar Toplek",
    url: "https://github.com/AleksandarDev",
  }
} as const;

export const links = {
  sourceCode: "https://github.com/AleksandarDev/numera-now-app",
} as const;