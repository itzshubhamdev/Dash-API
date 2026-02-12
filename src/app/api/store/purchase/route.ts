import { NextRequest, NextResponse } from "next/server";
import { getJWTPayload } from "@/lib/auth";
import {
  supabase,
  getUserByAuthUuid,
  getWallet,
  updateWalletBalance,
  recordTransaction,
} from "@/lib/supabase";
import { TokenPayload, PurchaseInput, StoreItem } from "@/lib/types";
import { updateServerBuild, getServerDetails } from "@/lib/pterodactyl";

// POST /api/store/purchase - Buy a store item
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

  // Parse input
  let body: PurchaseInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { itemId, serverId } = body;

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  // Fetch the store item
  const { data: item, error: itemError } = await supabase
    .from("store_items")
    .select("*")
    .eq("id", itemId)
    .eq("active", true)
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: "Store item not found or inactive" },
      { status: 404 },
    );
  }

  const storeItem = item as StoreItem;

  // Fetch wallet and check balance
  const wallet = await getWallet(user.id);

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (wallet.balance < storeItem.price) {
    return NextResponse.json(
      {
        error: "Insufficient balance",
        required: storeItem.price,
        current: wallet.balance,
      },
      { status: 400 },
    );
  }

  // Apply item effect based on type
  const itemType = storeItem.type;

  if (
    itemType === "ram_boost" ||
    itemType === "cpu_boost" ||
    itemType === "disk_boost"
  ) {
    // Server-bound addons require a serverId
    if (!serverId) {
      return NextResponse.json(
        { error: "serverId is required for this item type" },
        { status: 400 },
      );
    }

    // Verify the server belongs to this user
    const { data: server, error: serverError } = await supabase
      .from("servers")
      .select("id, ptero_server_id")
      .eq("id", serverId)
      .eq("user_id", user.id)
      .eq("deleted", false)
      .single();

    if (serverError || !server) {
      return NextResponse.json(
        { error: "Server not found or does not belong to you" },
        { status: 404 },
      );
    }

    // Get current Pterodactyl server details for the allocation ID
    const pteroDetails = await getServerDetails(server.ptero_server_id);

    if (!pteroDetails) {
      return NextResponse.json(
        { error: "Failed to fetch server details from panel" },
        { status: 502 },
      );
    }

    const defaultAllocation = pteroDetails.relationships.allocations.data.find(
      (a) => a.attributes.is_default,
    );

    if (!defaultAllocation) {
      return NextResponse.json(
        { error: "Could not determine server allocation" },
        { status: 500 },
      );
    }

    // Build the limits update from item config
    const limits: { memory?: number; cpu?: number; disk?: number } = {};

    if (itemType === "ram_boost" && storeItem.config.ram_add) {
      limits.memory = pteroDetails.limits.memory + storeItem.config.ram_add;
    } else if (itemType === "cpu_boost" && storeItem.config.cpu_add) {
      limits.cpu = pteroDetails.limits.cpu + storeItem.config.cpu_add;
    } else if (itemType === "disk_boost" && storeItem.config.disk_add) {
      limits.disk = pteroDetails.limits.disk + storeItem.config.disk_add;
    }

    // Apply via Pterodactyl admin API
    const updated = await updateServerBuild(
      pteroDetails.identifier as any, // Application API uses internal integer ID
      limits,
      defaultAllocation.attributes.id,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to apply boost to server" },
        { status: 502 },
      );
    }
  }
  // For non-server items (e.g., unban_pass, subdomain), no Ptero side-effect needed

  // Deduct from wallet
  const newBalance = wallet.balance - storeItem.price;
  const updatedWallet = await updateWalletBalance(user.id, newBalance);

  if (!updatedWallet) {
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 },
    );
  }

  // Record transaction
  await recordTransaction(
    user.id,
    -storeItem.price,
    "store_purchase",
    storeItem.id,
  );

  // Record the purchase
  const { error: purchaseError } = await supabase
    .from("store_purchases")
    .insert({
      user_id: user.id,
      item_id: storeItem.id,
      server_id: serverId || null,
    });

  if (purchaseError) {
    console.error("Error recording purchase:", purchaseError);
  }

  return NextResponse.json({
    success: true,
    item: {
      id: storeItem.id,
      name: storeItem.name,
      type: storeItem.type,
    },
    new_balance: newBalance,
  });
}
