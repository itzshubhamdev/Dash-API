import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { TokenPayload } from "./types";

let supabaseInstance: SupabaseClient | null = null;

// Get or create the Supabase client (lazy initialization)
function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables",
      );
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseInstance;
}

// Export a proxy object that lazily accesses the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Helper to get user from our users table by auth UUID
export async function getUserByAuthUuid(authUuid: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_uuid", authUuid)
    .single();

  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }

  return data;
}

// Helper to create user
export async function createUser(token: TokenPayload) {
  const { data, error } = await supabase
    .from("users")
    .insert({ auth_uuid: token.sub, email: token.email, role: "user" })
    .select()
    .single();

  if (error) {
    console.error("Error creating user:", error);
    return null;
  }

  return data;
}

// Helper to get user's wallet
export async function getWallet(userId: number) {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching wallet:", error);
    return null;
  }

  return data;
}

// Helper to create wallet
export async function createWallet(userId: number) {
  const { data, error } = await supabase
    .from("wallets")
    .insert({ user_id: userId, coins: 0, credits: 0 })
    .select()
    .single();

  if (error) {
    console.error("Error creating wallet:", error);
    return null;
  }

  return data;
}

// Helper to update wallet balance
export async function updateWalletBalance(userId: number, newBalance: number) {
  const { data, error } = await supabase
    .from("wallets")
    .update({ coins: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating wallet:", error);
    return null;
  }

  return data;
}

// Helper to record a transaction
export async function recordTransaction(
  userId: number,
  amount: number,
  type: string,
  referenceId?: number,
) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      amount,
      type,
      reference_id: referenceId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error recording transaction:", error);
    return null;
  }

  return data;
}
