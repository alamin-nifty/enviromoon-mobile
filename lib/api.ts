// ✅ THIS IS YOUR EXACT IP FROM IPCONFIG
const API_URL = "http://192.168.68.110:5000/api";

console.log("🚀 App connecting to:", API_URL);

// ====================================================================
// 1. TYPES
// ====================================================================

export interface SensorData {
  temperature: number;
  humidity: number;
  ldr: number;
  timestamp: string;
}

export interface LatestSensorReading {
  temperature: number;
  humidity: number;
  ldr: number;
  timestamp: string;
  formatted?: string;
  message?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastDataReceived: any;
  lastStatusUpdate: any;
  lastCommandPoll: any;
  statistics: {
    totalDataReceived: number;
    totalCommandsSent: number;
  };
  latestSensorData: SensorData | null;
}

export interface Alert {
  _id?: string;
  message: string;
  timestamp: string;
}

// ====================================================================
// 2. API FUNCTIONS
// ====================================================================

// Get the most recent sensor reading
export async function getLatestSensorReading(): Promise<LatestSensorReading> {
  try {
    const response = await fetch(`${API_URL}/sensors/latest`);
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ FETCH ERROR:", error);
    // Return safe default so app doesn't crash
    return {
      temperature: 0,
      humidity: 0,
      ldr: 0,
      timestamp: new Date().toISOString(),
      message: "Not Connected",
    };
  }
}

// Check device connection status
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  try {
    const response = await fetch(`${API_URL}/device/connection`);
    if (!response.ok) throw new Error("Network response was not ok");
    return await response.json();
  } catch (error) {
    return {
      isConnected: false,
      lastDataReceived: null,
      lastStatusUpdate: null,
      lastCommandPoll: null,
      statistics: { totalDataReceived: 0, totalCommandsSent: 0 },
      latestSensorData: null,
    };
  }
}

// Get readings with time range
export async function getSensorDataByRange(
  start: Date,
  end: Date,
  limit?: number
): Promise<SensorData[]> {
  try {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      limit: limit ? limit.toString() : "100",
    });

    const response = await fetch(`${API_URL}/sensors/range?${params}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.log("Range fetch failed (backend likely offline)");
    return [];
  }
}

// Queue a command for ESP32
export async function queueCommand(command: string) {
  try {
    const response = await fetch(`${API_URL}/device/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Update sampling interval
export async function updateSamplingInterval(interval: number) {
  try {
    const response = await fetch(`${API_URL}/settings/sampling-interval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}
