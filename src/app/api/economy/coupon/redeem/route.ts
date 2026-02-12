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

// POST /api/economy/coupon/redeem - Redeem a promo code
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
  let code: string;
  try {
    const body = await request.json();
    code = body.code?.trim()?.toUpperCase();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Coupon code is required" },
      { status: 400 },
    );
  }

  // Find the coupon
  const { data: coupon, error: couponError } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .single();

  if (couponError || !coupon) {
    return NextResponse.json(
      { error: "Invalid or expired coupon code" },
      { status: 404 },
    );
  }

  // Check if coupon has expired
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This coupon has expired" },
      { status: 410 },
    );
  }

  // Check if max uses reached
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json(
      { error: "This coupon has reached its maximum uses" },
      { status: 410 },
    );
  }

  // Check if user already used this coupon (using transactions)
  const { data: existingUse, error: useError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "coupon_redeem")
    .eq("reference_id", coupon.id)
    .limit(1)
    .single();

  if (existingUse) {
    return NextResponse.json(
      { error: "You have already used this coupon" },
      { status: 409 },
    );
  }

  // Get wallet
  const wallet = await getWallet(user.id);

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  // Update wallet balance
  const newBalance = wallet.balance + coupon.amount;
  const updatedWallet = await updateWalletBalance(user.id, newBalance);

  if (!updatedWallet) {
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 },
    );
  }

  // Update total earned
  await supabase
    .from("wallets")
    .update({ totat_earned: (wallet.totat_earned || 0) + coupon.amount })
    .eq("user_id", user.id);

  // Increment coupon used count
  await supabase
    .from("coupons")
    .update({ used_count: (coupon.used_count || 0) + 1 })
    .eq("id", coupon.id);

  // Record transaction
  await recordTransaction(user.id, coupon.amount, "coupon_redeem", coupon.id);

  return NextResponse.json({
    success: true,
    code: coupon.code,
    amount: coupon.amount,
    new_balance: newBalance,
  });
}
