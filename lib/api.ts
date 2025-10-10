export interface SensorData {
  temperature: number;
  humidity: number;
  ldr: number;
  timestamp: string;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
}

export async function getLatestSensorData(): Promise<SensorData[]> {
  const res = await fetch(`${API_BASE_URL}/sensors`);
  return handleResponse<SensorData[]>(res);
}

export async function getSensorDataByRange(
  start: Date,
  end: Date,
  limit?: number
): Promise<SensorData[]> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
    ...(limit ? { limit: String(limit) } : {}),
  });
  const res = await fetch(`${API_BASE_URL}/sensors/range?${params.toString()}`);
  return handleResponse<SensorData[]>(res);
}

export async function updateSamplingInterval(
  intervalSeconds: number
): Promise<{ success: boolean; interval: number }> {
  const res = await fetch(`${API_BASE_URL}/settings/sampling-interval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval: intervalSeconds }),
  });
  return handleResponse(res);
}

export async function triggerImmediateRead(): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/sensors/read`, { method: "POST" });
  return handleResponse(res);
}
