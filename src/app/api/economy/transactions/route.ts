import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import { supabase, getUserByAuthUuid } from "@/lib/supabase";
import { TokenPayload } from "@/lib/types";

// GET /api/economy/transactions - Paginated transaction history
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

  // Parse pagination params
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20")),
  );
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    console.error("Error counting transactions:", countError);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }

  // Fetch paginated transactions
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, amount, type, reference_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }

  const totalPages = Math.ceil((count || 0) / limit);

  return NextResponse.json({
    transactions,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}
