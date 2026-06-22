import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { findByUsername, verifyPassword, findOrCreateGoogleUser, recordLogin, recordFailedLogin, clearFailedLogins, isLockedOut } from "./users";
import { isIPRateLimited, recordIPAttempt, clearIPAttempts } from "./loginRateLimit";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const ip = (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
          ?? "unknown";

        if (isIPRateLimited(ip)) return null;

        if (!credentials?.username || !credentials?.password) return null;

        if (isLockedOut(credentials.username)) {
          recordIPAttempt(ip);
          return null;
        }

        const user = findByUsername(credentials.username);
        if (!user) {
          recordIPAttempt(ip);
          return null;
        }

        const ok = await verifyPassword(credentials.password, user.passwordHash ?? "");
        if (!ok) {
          recordIPAttempt(ip);
          recordFailedLogin(credentials.username);
          return null;
        }

        clearIPAttempts(ip);
        clearFailedLogins(credentials.username);
        return { id: user.id, name: user.username };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = findOrCreateGoogleUser(user.email);
        user.name = dbUser.username;
      }
      if (user.name) recordLogin(user.name);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.name) token.username = user.name;
      return token;
    },
    async session({ session, token }) {
      if (token.username && session.user) session.user.name = token.username as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
