import { getJWTPayload } from "@/lib/auth";
import { createUser, getUserByAuthUuid } from "@/lib/supabase";
import { TokenPayload } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const payload = (await getJWTPayload(request)) as TokenPayload | null;

  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  let user = await getUserByAuthUuid(payload.sub);

  if (!user) {
    user = await createUser(payload);
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return new Response(JSON.stringify(user), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
