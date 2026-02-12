import { getJWTPayload } from "@/lib/auth";
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

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
