const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const jwks = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });
    return payload;
  } catch (error) {
    console.error("Token Verification failed: ", error);
    return null;
  }
}

export async function getJWTPayload(request: NextRequest) {
  const headers = new Headers(request.headers);
  const authHeader = headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token);

  return payload;
}

export async function getUser(request: NextRequest) {
  const headers = new Headers(request.headers);
  const authHeader = headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const r = await fetch(`${supabaseUrl}/auth/v1/oauth/userinfo`, {
    headers: {
      Authorization: authHeader,
    },
  });

  const user = await r.json();

  return user;
}
