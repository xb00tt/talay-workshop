import { getRequestConfig } from "next-intl/server";
import { auth } from "@/auth";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  // Locale from user session preference; fall back to default
  const session = await auth();
  const locale =
    (session?.user?.preferredLocale as string) ?? routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
