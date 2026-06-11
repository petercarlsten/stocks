import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const FILE = path.join(process.cwd(), "data", "users.json");

interface User {
  id: string;
  username: string;
  passwordHash: string;
}

function readUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

export function findByUsername(username: string): User | undefined {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function findById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

export async function createUser(username: string, password: string): Promise<User> {
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already taken");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = { id: crypto.randomUUID(), username, passwordHash };
  writeUsers([...users, user]);
  return user;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
