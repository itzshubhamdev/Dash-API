import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import {
  supabase,
  getUserByAuthUuid,
  getWallet,
  updateWalletBalance,
  recordTransaction,
} from "@/lib/supabase";
import { TokenPayload } from "@/lib/types";

// POST /api/economy/daily/claim - Claim daily reward
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

  // Get daily reward config
  const { data: config, error: configError } = await supabase
    .from("config")
    .select("value")
    .eq("key", "daily_reward")
    .single();

  const rewardAmount = config?.value?.amount || 10;
  const cooldownHours = config?.value?.cooldown_hours || 24;

  // Check last claim
  const { data: lastClaim, error: claimError } = await supabase
    .from("daily_claims")
    .select("claimed_at")
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .single();

  if (lastClaim) {
    const lastClaimTime = new Date(lastClaim.claimed_at);
    const now = new Date();
    const hoursSinceLastClaim =
      (now.getTime() - lastClaimTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastClaim < cooldownHours) {
      const nextClaimTime = new Date(
        lastClaimTime.getTime() + cooldownHours * 60 * 60 * 1000,
      );
      return NextResponse.json(
        {
          error: "Daily reward already claimed",
          next_claim_at: nextClaimTime.toISOString(),
          hours_remaining: Math.ceil(cooldownHours - hoursSinceLastClaim),
        },
        { status: 429 },
      );
    }
  }

  // Get wallet
  const wallet = await getWallet(user.id);

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  // Update wallet balance
  const newBalance = wallet.balance + rewardAmount;
  const updatedWallet = await updateWalletBalance(user.id, newBalance);

  if (!updatedWallet) {
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 },
    );
  }

  // Also update total earned
  await supabase
    .from("wallets")
    .update({ totat_earned: (wallet.totat_earned || 0) + rewardAmount })
    .eq("user_id", user.id);

  // Record the claim
  const { error: insertError } = await supabase.from("daily_claims").insert({
    user_id: user.id,
    amount: rewardAmount,
  });

  if (insertError) {
    console.error("Error recording daily claim:", insertError);
  }

  // Record transaction
  await recordTransaction(user.id, rewardAmount, "daily_claim");

  // Calculate next claim time
  const nextClaimTime = new Date();
  nextClaimTime.setHours(nextClaimTime.getHours() + cooldownHours);

  return NextResponse.json({
    success: true,
    amount: rewardAmount,
    new_balance: newBalance,
    next_claim_at: nextClaimTime.toISOString(),
  });
}
