import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/store/items - Returns all active store addons
export async function GET(request: NextRequest) {
  const { data: items, error } = await supabase
    .from("store_items")
    .select("id, name, type, price, config")
    .eq("active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("Error fetching store items:", error);
    return NextResponse.json(
      { error: "Failed to fetch store items" },
      { status: 500 },
    );
  }

  return NextResponse.json({ items: items || [] });
}
