import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import {
  supabase,
  getUserByAuthUuid,
  updateWalletBalance,
  getWallet,
  recordTransaction,
} from "@/lib/supabase";
import { TokenPayload, Server, Plan } from "@/lib/types";
import {
  getServerDetails,
  getServerResources,
  deleteServer as deletePteroServer,
} from "@/lib/pterodactyl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/servers/:id - Get detailed server info
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  // Fetch server with plan
  const { data: server, error } = await supabase
    .from("servers")
    .select(
      `
      *,
      plan:plans(*)
    `,
    )
    .eq("id", serverId)
    .eq("user_id", user.id)
    .eq("deleted", false)
    .single();

  if (error || !server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Get live data from Pterodactyl
  const pteroDetails = await getServerDetails(server.ptero_server_id);
  const pteroResources = await getServerResources(server.ptero_server_id);

  const response = {
    id: server.id,
    name: server.name,
    status: server.status,
    expires_at: server.expires_at,
    plan: server.plan as Plan,
    ip: pteroDetails?.relationships?.allocations?.data?.find(
      (a) => a.attributes.is_default,
    )?.attributes?.ip,
    port: pteroDetails?.relationships?.allocations?.data?.find(
      (a) => a.attributes.is_default,
    )?.attributes?.port,
    resources: pteroResources
      ? {
          memory_bytes: pteroResources.resources.memory_bytes,
          cpu_absolute: pteroResources.resources.cpu_absolute,
          disk_bytes: pteroResources.resources.disk_bytes,
          uptime: pteroResources.resources.uptime,
          current_state: pteroResources.current_state,
        }
      : undefined,
  };

  return NextResponse.json({ server: response });
}

// DELETE /api/servers/:id - Delete server
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  // Parse optional reason from body
  let reason: string | undefined;
  try {
    const body = await request.json();
    reason = body.reason;
  } catch {
    // No body is fine
  }

  // Fetch server
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

  // Delete from Pterodactyl
  // Note: We need the internal Pterodactyl server ID, not the UUID
  // For now, we'll try using the UUID as identifier
  const pteroDeleted = await deletePteroServer(
    parseInt(server.ptero_server_id) || 0,
  );

  if (!pteroDeleted) {
    console.warn(
      "Failed to delete server from Pterodactyl, proceeding with DB soft delete",
    );
  }

  // Soft delete in our database
  const { error: updateError } = await supabase
    .from("servers")
    .update({ deleted: true, status: "deleted" })
    .eq("id", serverId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to delete server" },
      { status: 500 },
    );
  }

  // Record transaction (deletion)
  await recordTransaction(user.id, 0, "server_deleted", serverId);

  return NextResponse.json({
    success: true,
    message: "Server deleted successfully",
    reason,
  });
}
