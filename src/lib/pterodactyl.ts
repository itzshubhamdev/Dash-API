import {
  CreateServerOptions,
  PterodactylResourceUsage,
  PterodactylServerDetails,
} from "./types";

const PTERODACTYL_URL = process.env.PTERODACTYL_URL!;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY!;

const headers = {
  Authorization: `Bearer ${PTERODACTYL_API_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

// Get server details from Client API
export async function getServerDetails(
  serverId: string,
): Promise<PterodactylServerDetails | null> {
  try {
    const response = await fetch(
      `${PTERODACTYL_URL}/api/client/servers/${serverId}`,
      {
        headers,
      },
    );

    if (!response.ok) {
      console.error("Failed to get server details:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.attributes;
  } catch (error) {
    console.error("Error fetching server details:", error);
    return null;
  }
}

// Get server resource usage from Client API
export async function getServerResources(
  serverId: string,
): Promise<PterodactylResourceUsage | null> {
  try {
    const response = await fetch(
      `${PTERODACTYL_URL}/api/client/servers/${serverId}/resources`,
      {
        headers,
      },
    );

    if (!response.ok) {
      console.error("Failed to get server resources:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.attributes;
  } catch (error) {
    console.error("Error fetching server resources:", error);
    return null;
  }
}

// Send power action to server
export async function sendPowerAction(
  serverId: string,
  action: "start" | "stop" | "restart" | "kill",
): Promise<boolean> {
  try {
    const response = await fetch(
      `${PTERODACTYL_URL}/api/client/servers/${serverId}/power`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ signal: action }),
      },
    );

    if (!response.ok) {
      console.error("Failed to send power action:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending power action:", error);
    return false;
  }
}

// Create server using Application API
export async function createServer(
  options: CreateServerOptions,
): Promise<{ id: number; identifier: string; uuid: string } | null> {
  try {
    const body = {
      name: options.name,
      user: options.userId,
      egg: options.eggId,
      limits: {
        memory: options.ram,
        swap: 0,
        disk: options.disk,
        io: 500,
        cpu: options.cpu,
      },
      feature_limits: {
        databases: 0,
        allocations: 1,
        backups: 0,
      },
      deploy: {
        locations: [options.locationId],
        dedicated_ip: false,
        port_range: [],
      },
      start_on_completion: false,
    };

    const response = await fetch(`${PTERODACTYL_URL}/api/application/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Failed to create server:", await response.text());
      return null;
    }

    const data = await response.json();
    return {
      id: data.attributes.id,
      identifier: data.attributes.identifier,
      uuid: data.attributes.uuid,
    };
  } catch (error) {
    console.error("Error creating server:", error);
    return null;
  }
}

// Delete server using Application API
export async function deleteServer(serverId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${PTERODACTYL_URL}/api/application/servers/${serverId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok && response.status !== 204) {
      console.error("Failed to delete server:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting server:", error);
    return false;
  }
}

// Get Pterodactyl user ID by email
export async function getPterodactylUserByEmail(
  email: string,
): Promise<number | null> {
  try {
    const response = await fetch(
      `${PTERODACTYL_URL}/api/application/users?filter[email]=${encodeURIComponent(email)}`,
      {
        headers,
      },
    );

    if (!response.ok) {
      console.error("Failed to get Pterodactyl user:", await response.text());
      return null;
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].attributes.id;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Pterodactyl user:", error);
    return null;
  }
}

// Create Pterodactyl user
export async function createPterodactylUser(
  email: string,
  username: string,
  firstName: string,
  lastName: string,
): Promise<number | null> {
  try {
    const response = await fetch(`${PTERODACTYL_URL}/api/application/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        username,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!response.ok) {
      console.error(
        "Failed to create Pterodactyl user:",
        await response.text(),
      );
      return null;
    }

    const data = await response.json();
    return data.attributes.id;
  } catch (error) {
    console.error("Error creating Pterodactyl user:", error);
    return null;
  }
}

// Update server build limits (RAM, CPU, disk) using Application API
export async function updateServerBuild(
  serverId: number,
  limits: { memory?: number; cpu?: number; disk?: number },
  allocationId: number,
): Promise<boolean> {
  try {
    // First get the current server details to preserve existing values
    const getResponse = await fetch(
      `${PTERODACTYL_URL}/api/application/servers/${serverId}`,
      { headers },
    );

    if (!getResponse.ok) {
      console.error(
        "Failed to get server for build update:",
        await getResponse.text(),
      );
      return false;
    }

    const serverData = await getResponse.json();
    const currentLimits = serverData.attributes.limits;

    const response = await fetch(
      `${PTERODACTYL_URL}/api/application/servers/${serverId}/build`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          allocation: allocationId,
          memory: limits.memory ?? currentLimits.memory,
          swap: currentLimits.swap,
          disk: limits.disk ?? currentLimits.disk,
          io: currentLimits.io,
          cpu: limits.cpu ?? currentLimits.cpu,
          feature_limits: serverData.attributes.feature_limits,
        }),
      },
    );

    if (!response.ok) {
      console.error("Failed to update server build:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating server build:", error);
    return false;
  }
}
