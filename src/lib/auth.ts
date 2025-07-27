import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

const COOKIE_NAME = "auth-token";
const SESSION_DURATION_DAYS = 7;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  email: string;
  expiresAt: Date;
}

export async function createSession(userId: string, email: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session: SessionPayload = { userId, email, expiresAt };

  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const session = payload as unknown as SessionPayload;
    
    if (!session.userId || !session.email) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.warn('Failed to verify session token:', error);
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function verifySession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const session = payload as unknown as SessionPayload;
    
    if (!session.userId || !session.email) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.warn('Failed to verify session from request:', error);
    return null;
  }
}
