import type { Metadata } from "next";

export const siteConfig: Metadata = {
  title: "Numera Now",
  description: "Your finances, now. Numera Now is a finance tracker app that helps you keep track of your transactions, accounts, and more.",
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
  ] as Array<string>,
  authors: {
    name: "Aleksandar Toplek",
    url: "https://github.com/AleksandarDev",
  },
} as const;

export const links = {
  sourceCode: "https://github.com/thounny/finance-tracker",
} as const;