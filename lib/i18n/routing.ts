import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["bg", "en"],
  defaultLocale: "bg",
  // No locale prefix in URLs — locale stored in user preferences
  localePrefix: "never",
});
