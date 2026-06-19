import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { findByUsername, verifyPassword, findOrCreateGoogleUser, recordLogin } from "./users";

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = findByUsername(credentials.username);
        if (!user) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash ?? "");
        if (!ok) return null;
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
