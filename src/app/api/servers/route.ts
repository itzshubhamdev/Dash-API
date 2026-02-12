import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import { supabase, getUserByAuthUuid } from "@/lib/supabase";
import { TokenPayload, ServerListItem } from "@/lib/types";

// GET /api/servers - List all user servers
export async function GET(request: NextRequest) {
  // Authenticate user
  const payload = (await getJWTPayload(request)) as TokenPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user from our database
  const user = await getUserByAuthUuid(payload.sub);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch user's servers
  const { data: servers, error } = await supabase
    .from("servers")
    .select("id, name, status, expires_at")
    .eq("user_id", user.id)
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching servers:", error);
    return NextResponse.json(
      { error: "Failed to fetch servers" },
      { status: 500 },
    );
  }

  const serverList: ServerListItem[] = servers.map((server) => ({
    id: server.id,
    name: server.name,
    status: server.status,
    expires_at: server.expires_at,
  }));

  return NextResponse.json({ servers: serverList });
}
