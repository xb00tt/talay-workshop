import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { SESSION_MAX_AGE } from "@/lib/constants";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { username: credentials.username as string },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: JSON.parse(user.permissions) as string[],
          preferredLocale: user.preferredLocale,
          darkMode: user.darkMode,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Rolling 1-hour JWT session.
     * `updateAge` is ignored for JWT strategy in Auth.js v5, so we manually
     * extend exp on every invocation. Middleware calls auth() on every
     * protected route, which triggers this callback and reissues the cookie.
     */
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: populate token from user returned by authorize()
        token.id = user.id ?? "";
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role;
        token.permissions = (user as { permissions: string[] }).permissions;
        token.preferredLocale = (user as { preferredLocale: string }).preferredLocale;
        token.darkMode = (user as { darkMode: boolean }).darkMode;
      }

      // Always extend expiry — rolling window
      token.exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.permissions = token.permissions as string[];
        session.user.preferredLocale = token.preferredLocale as string;
        session.user.darkMode = token.darkMode as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
