import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import { getUserByAuthUuid, getWallet, createWallet } from "@/lib/supabase";
import { TokenPayload } from "@/lib/types";

// GET /api/economy/wallet - Get wallet balance and stats
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

  // Get wallet
  let wallet = await getWallet(user.id);

  if (!wallet) {
    wallet = await createWallet(user.id);
  }

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  return NextResponse.json({
    coins: wallet.coins,
    credits: wallet.credits,
    total_earned: wallet.total_earned,
  });
}
