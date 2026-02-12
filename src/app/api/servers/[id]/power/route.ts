import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import { supabase, getUserByAuthUuid } from "@/lib/supabase";
import { TokenPayload, PowerActionInput } from "@/lib/types";
import { sendPowerAction } from "@/lib/pterodactyl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/servers/:id/power - Send power action to server
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const serverId = parseInt(id);

  if (isNaN(serverId)) {
    return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
  }

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

  // Parse request body
  let input: PowerActionInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { action } = input;
  const validActions = ["start", "stop", "restart", "kill"];

  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be one of: start, stop, restart, kill" },
      { status: 400 },
    );
  }

  // Fetch server and verify ownership
  const { data: server, error } = await supabase
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .eq("user_id", user.id)
    .eq("deleted", false)
    .single();

  if (error || !server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Check if server is expired
  if (new Date(server.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Server has expired. Please renew to continue using it." },
      { status: 403 },
    );
  }

  // Send power action to Pterodactyl
  const success = await sendPowerAction(server.ptero_server_id, action);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to send power action" },
      { status: 500 },
    );
  }

  // Update server status in our database
  const statusMap: Record<string, string> = {
    start: "starting",
    stop: "stopping",
    restart: "restarting",
    kill: "offline",
  };

  await supabase
    .from("servers")
    .update({ status: statusMap[action] })
    .eq("id", serverId);

  return NextResponse.json({
    success: true,
    action,
    message: `Power action '${action}' sent successfully`,
  });
}
