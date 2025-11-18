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

export interface DeviceStatus {
  connected: boolean;
  uptime: number;
  totalReadings: number;
  serialPort: string;
  timestamp?: string;
  message?: string;
}

export interface DeviceSettings {
  temperatureOffset: number;
  humidityOffset: number;
  lightThreshold: number;
  alertThresholds: {
    temperature: { min: number; max: number };
    humidity: { min: number; max: number };
    light: { min: number; max: number };
  };
  autoReconnect: boolean;
  debugMode: boolean;
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

// Enable Temperature & Humidity Sensor
export async function enableTempSensor(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_URL}/sensors/temp/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Disable Temperature & Humidity Sensor
export async function disableTempSensor(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_URL}/sensors/temp/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Enable Light Sensor (LDR)
export async function enableLightSensor(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_URL}/sensors/light/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Disable Light Sensor (LDR)
export async function disableLightSensor(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_URL}/sensors/light/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Get device status
export async function getDeviceStatus(): Promise<DeviceStatus> {
  try {
    const response = await fetch(`${API_URL}/device/status`);
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ Error fetching device status:", error);
    return {
      connected: false,
      uptime: 0,
      totalReadings: 0,
      serialPort: "N/A",
      message: "Not Connected",
    };
  }
}

// Get device settings
export async function getDeviceSettings(): Promise<DeviceSettings> {
  try {
    const response = await fetch(`${API_URL}/device/settings`);
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ Error fetching device settings:", error);
    throw error;
  }
}

// Update calibration
export async function updateCalibration(
  temperatureOffset: number,
  humidityOffset: number,
  lightThreshold: number
) {
  try {
    const response = await fetch(`${API_URL}/device/calibration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperatureOffset,
        humidityOffset,
        lightThreshold,
      }),
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Update alert thresholds
export async function updateAlertThresholds(
  temperature: { min: number; max: number },
  humidity: { min: number; max: number }
) {
  try {
    const response = await fetch(`${API_URL}/device/alert-thresholds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperature,
        humidity,
      }),
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Trigger immediate sensor read
export async function triggerImmediateRead() {
  try {
    const response = await fetch(`${API_URL}/sensors/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Device control
export async function deviceControl(
  action: "led_on" | "led_off" | "reset" | "restart"
) {
  try {
    const response = await fetch(`${API_URL}/device/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Export data as CSV
export async function exportData(start: Date, end: Date): Promise<string> {
  try {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const response = await fetch(`${API_URL}/data/export?${params}`);
    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    throw error;
  }
}
