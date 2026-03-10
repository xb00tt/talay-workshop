import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    username: string;
    role: string;
    permissions: string[];
    preferredLocale: string;
    darkMode: boolean;
  }

  interface Session {
    user: User & {
      id: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: string;
    permissions: string[];
    preferredLocale: string;
    darkMode: boolean;
  }
}
