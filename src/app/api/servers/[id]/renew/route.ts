import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import {
  supabase,
  getUserByAuthUuid,
  getWallet,
  updateWalletBalance,
  recordTransaction,
} from "@/lib/supabase";
import { TokenPayload, Plan } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/servers/:id/renew - Extend server life
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

  const plan = server.plan as Plan;

  if (!plan) {
    return NextResponse.json(
      { error: "Plan not found for this server" },
      { status: 404 },
    );
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

  // Deduct coins from wallet
  const newBalance = wallet.balance - plan.price;
  const updatedWallet = await updateWalletBalance(user.id, newBalance);

  if (!updatedWallet) {
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 },
    );
  }

  // Calculate new expiry (extend by 30 days from current expiry or from now if expired)
  const currentExpiry = new Date(server.expires_at);
  const now = new Date();
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate);
  newExpiry.setDate(newExpiry.getDate() + 30);

  // Update server expiry
  const { error: updateError } = await supabase
    .from("servers")
    .update({ expires_at: newExpiry.toISOString() })
    .eq("id", serverId);

  if (updateError) {
    // Try to refund the balance
    await updateWalletBalance(user.id, wallet.balance);
    return NextResponse.json(
      { error: "Failed to update server expiry" },
      { status: 500 },
    );
  }

  // Record transaction
  await recordTransaction(user.id, -plan.price, "server_renew", serverId);

  return NextResponse.json({
    success: true,
    server: {
      id: serverId,
      expires_at: newExpiry.toISOString(),
    },
    wallet: {
      balance: newBalance,
    },
    cost: plan.price,
  });
}
