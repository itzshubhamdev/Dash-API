import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import {
  supabase,
  getUserByAuthUuid,
  getWallet,
  updateWalletBalance,
  recordTransaction,
} from "@/lib/supabase";
import { TokenPayload, DeployServerInput, Plan, Software } from "@/lib/types";
import {
  createServer,
  getPterodactylUserByEmail,
  createPterodactylUser,
} from "@/lib/pterodactyl";

// POST /api/servers/deploy - Create a new server
export async function POST(request: NextRequest) {
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
  let input: DeployServerInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { planId, name, softwareId, locationId } = input;

  if (!planId || !name || !softwareId || !locationId) {
    return NextResponse.json(
      {
        error: "Missing required fields: planId, name, softwareId, locationId",
      },
      { status: 400 },
    );
  }

  // Get the plan
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("active", true)
    .single();

  if (planError || !plan) {
    return NextResponse.json(
      { error: "Plan not found or inactive" },
      { status: 404 },
    );
  }

  // Get the software (for egg configuration)
  const { data: software, error: softwareError } = await supabase
    .from("softwares")
    .select("*")
    .eq("id", softwareId)
    .single();

  if (softwareError || !software) {
    return NextResponse.json({ error: "Software not found" }, { status: 404 });
  }

  // Check wallet balance
  const wallet = await getWallet(user.id);

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (wallet.balance < plan.price) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        required: plan.price,
        current: wallet.balance,
      },
      { status: 400 },
    );
  }

  // Get or create Pterodactyl user
  let pteroUserId = await getPterodactylUserByEmail(user.email);

  if (!pteroUserId) {
    // Create Pterodactyl user
    const username = user.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 20);
    pteroUserId = await createPterodactylUser(
      user.email,
      username + "_" + user.id,
      username,
      "User",
    );

    if (!pteroUserId) {
      return NextResponse.json(
        { error: "Failed to create Pterodactyl user" },
        { status: 500 },
      );
    }
  }

  // Create server on Pterodactyl
  // Note: You'll need to map softwareId to the correct egg/nest IDs
  // This is a simplified example - you may need a mapping table
  const pteroServer = await createServer({
    name,
    userId: pteroUserId,
    eggId: 1, // TODO: Map from softwareId
    nestId: 1, // TODO: Map from softwareId
    locationId,
    ram: (plan as Plan).ram,
    cpu: (plan as Plan).cpu,
    disk: (plan as Plan).disk,
  });

  if (!pteroServer) {
    return NextResponse.json(
      { error: "Failed to create server on Pterodactyl" },
      { status: 500 },
    );
  }

  // Deduct coins from wallet
  const newBalance = wallet.balance - plan.price;
  const updatedWallet = await updateWalletBalance(user.id, newBalance);

  if (!updatedWallet) {
    // TODO: Consider rolling back Pterodactyl server creation
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 },
    );
  }

  // Calculate expiry (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create server record in our database
  const { data: newServer, error: serverError } = await supabase
    .from("servers")
    .insert({
      user_id: user.id,
      plan_id: planId,
      ptero_server_id: pteroServer.uuid,
      name,
      status: "installing",
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (serverError || !newServer) {
    console.error("Error creating server record:", serverError);
    return NextResponse.json(
      { error: "Failed to create server record" },
      { status: 500 },
    );
  }

  // Record transaction
  await recordTransaction(user.id, -plan.price, "server_deploy", newServer.id);

  return NextResponse.json(
    {
      success: true,
      server: {
        id: newServer.id,
        name: newServer.name,
        status: newServer.status,
        expires_at: newServer.expires_at,
      },
      wallet: {
        balance: newBalance,
      },
    },
    { status: 201 },
  );
}
