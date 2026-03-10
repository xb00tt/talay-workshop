import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  // Default to Bulgarian for all requests.
  // Per-user locale preference is read from the session in individual pages
  // that need it, not here — avoids auth() calls on every edge request.
  const locale = routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
