import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getConnectionStatus,
  getLatestSensorReading,
  getSensorDataByRange,
  type SensorData,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

const TIME_RANGES = [
  { label: "1 Hour", value: "1h", hours: 1 },
  { label: "6 Hours", value: "6h", hours: 6 },
  { label: "24 Hours", value: "24h", hours: 24 },
  { label: "7 Days", value: "7d", hours: 168 },
  { label: "30 Days", value: "30d", hours: 720 },
];

export default function DashboardTab() {
  const [data, setData] = useState<SensorData[]>([]);
  const [latestReading, setLatestReading] = useState<SensorData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [timeRange, setTimeRange] = useState("6h");
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedChartSensor, setSelectedChartSensor] = useState<string | null>(
    null
  );
  const colorScheme = useColorScheme() ?? "light";

  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);

      // Fetch all data in parallel with timeout protection
      const fetchWithTimeout = async <T,>(
        promise: Promise<T>,
        timeoutMs: number = 5000
      ): Promise<T | null> => {
        try {
          const timeout = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), timeoutMs)
          );
          return await Promise.race([promise, timeout]);
        } catch (err) {
          console.error("Fetch error:", err);
          return null;
        }
      };

      // Fetch latest reading first (with timeout)
      const latestPromise = fetchWithTimeout(getLatestSensorReading(), 5000);
      const connectionPromise = fetchWithTimeout(getConnectionStatus(), 5000);

      // Fetch historical data
      const end = new Date();
      const start = new Date();
      const selectedRange = TIME_RANGES.find((r) => r.value === timeRange);
      const hours = selectedRange?.hours || 6;
      start.setHours(start.getHours() - hours);

      // Adjust limit based on time range for better data coverage
      let limit = 100;
      if (hours >= 168) limit = 200; // 7 days or more
      else if (hours >= 24) limit = 150; // 24 hours or more

      const readingsPromise = fetchWithTimeout(
        getSensorDataByRange(start, end, limit),
        10000
      );

      // Wait for all promises
      const [latest, connection, readings] = await Promise.all([
        latestPromise,
        connectionPromise,
        readingsPromise,
      ]);

      // Process latest reading
      if (latest && !latest.message) {
        setLatestReading({
          temperature: latest.temperature,
          humidity: latest.humidity,
          ldr: latest.ldr,
          timestamp: latest.timestamp,
        });
      }

      // Process connection status
      if (connection) {
        setIsConnected(connection.isConnected);
      }

      // Process readings
      if (readings && Array.isArray(readings)) {
        console.log(
          `Fetched ${readings.length} readings for ${selectedRange?.label}`
        );
        setData(readings);

        // If we have data but no latest reading was fetched from latest endpoint, use first item
        if (readings.length > 0 && !latest) {
          setLatestReading(readings[0]);
        }
      } else {
        // If readings failed, try to use empty array
        setData([]);
      }

      setLastUpdate(new Date());

      // If all requests failed, show error
      if (!latest && !connection && !readings) {
        setError(
          "Failed to connect to server. Check if backend is running and IP is correct."
        );
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      const errorMessage =
        err?.message ||
        "Failed to fetch data. Make sure the backend server is running.";
      setError(errorMessage);
      setData([]);
    } finally {
      // Always stop loading, even if there were errors
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    setShowTimeRangePicker(false);
    setLoading(true);
    // useEffect will trigger fetchData when timeRange changes
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]); // Only re-run when timeRange changes (fetchData uses timeRange)

  // Use latestReading if available, otherwise fall back to first item in data
  const latest = latestReading || (data.length > 0 ? data[0] : null);

  // Calculate comprehensive statistics
  const statistics = useMemo(() => {
    if (data.length === 0) {
      return {
        temperature: {
          current: "--",
          min: "--",
          max: "--",
          avg: "--",
          trend: 0,
        },
        humidity: { current: "--", min: "--", max: "--", avg: "--", trend: 0 },
        light: { current: "--", min: "--", max: "--", avg: "--", trend: 0 },
      };
    }

    const validData = data.filter(
      (d) =>
        typeof d.temperature === "number" &&
        !isNaN(d.temperature) &&
        typeof d.humidity === "number" &&
        !isNaN(d.humidity) &&
        typeof d.ldr === "number" &&
        !isNaN(d.ldr)
    );

    if (validData.length === 0) {
      return {
        temperature: {
          current: "--",
          min: "--",
          max: "--",
          avg: "--",
          trend: 0,
        },
        humidity: { current: "--", min: "--", max: "--", avg: "--", trend: 0 },
        light: { current: "--", min: "--", max: "--", avg: "--", trend: 0 },
      };
    }

    const temps = validData.map((d) => d.temperature);
    const humids = validData.map((d) => d.humidity);
    const lights = validData.map((d) => d.ldr);

    // Calculate trends (compare first half vs second half)
    const midPoint = Math.floor(validData.length / 2);
    const firstHalfAvg = {
      temp: temps.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint,
      humid: humids.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint,
      light: lights.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint,
    };
    const secondHalfAvg = {
      temp:
        temps.slice(midPoint).reduce((a, b) => a + b, 0) /
        (validData.length - midPoint),
      humid:
        humids.slice(midPoint).reduce((a, b) => a + b, 0) /
        (validData.length - midPoint),
      light:
        lights.slice(midPoint).reduce((a, b) => a + b, 0) /
        (validData.length - midPoint),
    };

    return {
      temperature: {
        current: latest?.temperature?.toFixed(1) || "--",
        min: Math.min(...temps).toFixed(1),
        max: Math.max(...temps).toFixed(1),
        avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
        trend: secondHalfAvg.temp - firstHalfAvg.temp,
      },
      humidity: {
        current: latest?.humidity?.toFixed(1) || "--",
        min: Math.min(...humids).toFixed(1),
        max: Math.max(...humids).toFixed(1),
        avg: (humids.reduce((a, b) => a + b, 0) / humids.length).toFixed(1),
        trend: secondHalfAvg.humid - firstHalfAvg.humid,
      },
      light: {
        current: latest?.ldr?.toString() || "--",
        min: Math.min(...lights).toString(),
        max: Math.max(...lights).toString(),
        avg: Math.round(
          lights.reduce((a, b) => a + b, 0) / lights.length
        ).toString(),
        trend: secondHalfAvg.light - firstHalfAvg.light,
      },
    };
  }, [data, latest]);

  const summary = useMemo(() => {
    return {
      temperature: `${statistics.temperature.current}°C`,
      humidity: `${statistics.humidity.current}%`,
      light: statistics.light.current,
    };
  }, [statistics]);
  // Prepare chart data based on selected time range
  const chartData = useMemo(() => {
    if (data.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            data: [],
            color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
            strokeWidth: 2,
          },
          {
            data: [],
            color: (opacity = 1) => `rgba(79, 195, 247, ${opacity})`,
            strokeWidth: 2,
          },
          {
            data: [],
            color: (opacity = 1) => `rgba(255, 167, 38, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      };
    }

    const selectedRange = TIME_RANGES.find((r) => r.value === timeRange);
    const hours = selectedRange?.hours || 6;

    // Adjust max points based on time range
    let maxPoints = 20;
    if (hours >= 168) maxPoints = 30; // 7+ days: show more points
    else if (hours >= 24) maxPoints = 25; // 24+ hours: show more points

    // Reverse data to show chronological order
    const reversedData = [...data].reverse();
    const step = Math.max(1, Math.floor(reversedData.length / maxPoints));
    const sampledData = reversedData.filter((_, i) => i % step === 0);

    // Format labels based on time range
    const formatLabel = (timestamp: string, idx: number, total: number) => {
      const date = new Date(timestamp);

      if (hours >= 168) {
        // For 7+ days, show date and time
        if (
          idx === 0 ||
          idx === total - 1 ||
          idx % Math.floor(total / 4) === 0
        ) {
          return (
            date.toLocaleDateString([], { month: "short", day: "numeric" }) +
            " " +
            date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          );
        }
        return "";
      } else if (hours >= 24) {
        // For 24+ hours, show time with date if needed
        if (
          idx === 0 ||
          idx === total - 1 ||
          idx % Math.floor(total / 5) === 0
        ) {
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        return "";
      } else {
        // For shorter ranges, show time
        if (total <= 5) {
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        if (
          idx === 0 ||
          idx === total - 1 ||
          idx % Math.floor(total / 4) === 0
        ) {
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        return "";
      }
    };

    return {
      labels: sampledData.map((item, idx) =>
        formatLabel(item.timestamp, idx, sampledData.length)
      ),
      datasets: [
        ...(selectedChartSensor === null ||
        selectedChartSensor === "temperature"
          ? [
              {
                data: sampledData.map((item) =>
                  typeof item.temperature === "number" &&
                  !isNaN(item.temperature)
                    ? item.temperature
                    : 0
                ),
                color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
                strokeWidth: 2,
              },
            ]
          : []),
        ...(selectedChartSensor === null || selectedChartSensor === "humidity"
          ? [
              {
                data: sampledData.map((item) =>
                  typeof item.humidity === "number" && !isNaN(item.humidity)
                    ? item.humidity
                    : 0
                ),
                color: (opacity = 1) => `rgba(79, 195, 247, ${opacity})`,
                strokeWidth: 2,
              },
            ]
          : []),
        ...(selectedChartSensor === null || selectedChartSensor === "light"
          ? [
              {
                data: sampledData.map((item) =>
                  typeof item.ldr === "number" && !isNaN(item.ldr)
                    ? item.ldr / 10
                    : 0
                ),
                color: (opacity = 1) => `rgba(255, 167, 38, ${opacity})`,
                strokeWidth: 2,
              },
            ]
          : []),
      ],
    };
  }, [data, timeRange, selectedChartSensor]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#E8F5E9", dark: "#1A2E24" }}
      headerImage={
        <Ionicons
          size={300}
          color={colorScheme === "dark" ? "#4FC3F7" : "#34A853"}
          name="stats-chart-outline"
          style={styles.headerImage}
        />
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Dashboard</ThemedText>
      </ThemedView>

      {/* Modern Data Controls */}
      <ThemedView
        card
        style={[
          styles.controlsCard,
          {
            borderColor: Colors[colorScheme].cardBorder,
            backgroundColor: Colors[colorScheme].card,
          },
        ]}
      >
        <View style={styles.controlsHeader}>
          <View style={styles.controlsHeaderLeft}>
            <Ionicons
              name="options-outline"
              size={20}
              color={Colors[colorScheme].tint}
            />
            <ThemedText type="defaultSemiBold" style={styles.controlsTitle}>
              Data Controls
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={[
              styles.refreshButton,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(79, 195, 247, 0.15)"
                    : "rgba(10, 126, 164, 0.1)",
              },
            ]}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color={Colors[colorScheme].tint}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={18}
                color={Colors[colorScheme].tint}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.controlsContent}>
          {/* Time Range Selector */}
          <View style={styles.controlGroup}>
            <View style={styles.controlLabelRow}>
              <Ionicons
                name="time-outline"
                size={16}
                color={Colors[colorScheme].icon}
              />
              <ThemedText style={styles.controlLabel}>Time Range</ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => setShowTimeRangePicker(!showTimeRangePicker)}
              style={[
                styles.selectorButton,
                {
                  backgroundColor: Colors[colorScheme].input,
                  borderColor: Colors[colorScheme].inputBorder,
                },
              ]}
            >
              <ThemedText style={styles.selectorText}>
                {TIME_RANGES.find((r) => r.value === timeRange)?.label ||
                  "6 Hours"}
              </ThemedText>
              <Ionicons
                name={
                  showTimeRangePicker
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={16}
                color={Colors[colorScheme].icon}
              />
            </TouchableOpacity>

            {showTimeRangePicker && (
              <View
                style={[
                  styles.pickerDropdown,
                  {
                    backgroundColor: Colors[colorScheme].card,
                    borderColor: Colors[colorScheme].cardBorder,
                  },
                ]}
              >
                {TIME_RANGES.map((range) => (
                  <TouchableOpacity
                    key={range.value}
                    onPress={() => handleTimeRangeChange(range.value)}
                    style={[
                      styles.pickerOption,
                      timeRange === range.value && {
                        backgroundColor:
                          colorScheme === "dark"
                            ? "rgba(79, 195, 247, 0.15)"
                            : "rgba(10, 126, 164, 0.1)",
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.pickerOptionText,
                        timeRange === range.value && {
                          color: Colors[colorScheme].tint,
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {range.label}
                    </ThemedText>
                    {timeRange === range.value && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={Colors[colorScheme].tint}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Status Indicator */}
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: error
                      ? "#FF6B6B"
                      : loading
                      ? "#FFA726"
                      : isConnected
                      ? "#4CAF50"
                      : "#FFA726",
                  },
                ]}
              />
              <ThemedText style={styles.statusText}>
                {error
                  ? "Disconnected"
                  : loading
                  ? "Loading..."
                  : isConnected
                  ? "Connected"
                  : "No Data"}
              </ThemedText>
            </View>
            <View style={styles.dataInfo}>
              <ThemedText style={styles.dataCount}>
                {data.length} readings
              </ThemedText>
              {lastUpdate && (
                <ThemedText style={styles.lastUpdate}>
                  Updated{" "}
                  {lastUpdate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </ThemedText>
              )}
            </View>
          </View>
        </View>
      </ThemedView>

      {error && (
        <ThemedView
          card
          style={[
            styles.errorCard,
            { borderColor: Colors[colorScheme].cardBorder },
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: "#FF6B6B", marginBottom: 8 }}
          >
            Connection Error
          </ThemedText>
          <ThemedText
            style={{ color: "#FF6B6B", fontSize: 14, lineHeight: 20 }}
          >
            {error}
          </ThemedText>
          <ThemedText
            style={{
              color: "#FF6B6B",
              fontSize: 12,
              lineHeight: 18,
              marginTop: 8,
              opacity: 0.8,
            }}
          >
            Check if the backend server is running on port 5000
          </ThemedText>
        </ThemedView>
      )}

      {!error && !loading && data.length === 0 && !latestReading && (
        <ThemedView
          card
          style={[
            styles.errorCard,
            { borderColor: Colors[colorScheme].cardBorder },
          ]}
        >
          <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>
            No Sensor Data Available
          </ThemedText>
          <ThemedText style={{ fontSize: 14, lineHeight: 20, opacity: 0.7 }}>
            {isConnected
              ? "Waiting for ESP32 to send data..."
              : "ESP32 is not connected. Make sure it's powered on and connected to WiFi."}
          </ThemedText>
        </ThemedView>
      )}

      {/* Current Readings */}
      <View style={styles.cardsContainer}>
        <StatCard
          label="Temperature"
          value={summary.temperature}
          icon="thermometer-outline"
          color="#FF6B6B"
          bgColor={colorScheme === "dark" ? "#2A1F1F" : "#FFF5F5"}
          stats={statistics.temperature}
          unit="°C"
          colorScheme={colorScheme}
        />
        <StatCard
          label="Humidity"
          value={summary.humidity}
          icon="water-outline"
          color="#4FC3F7"
          bgColor={colorScheme === "dark" ? "#1A252F" : "#F0F9FF"}
          stats={statistics.humidity}
          unit="%"
          colorScheme={colorScheme}
        />
        <StatCard
          label="Light"
          value={summary.light}
          icon="sunny-outline"
          color="#FFA726"
          bgColor={colorScheme === "dark" ? "#2A241F" : "#FFFBF0"}
          stats={statistics.light}
          unit=""
          colorScheme={colorScheme}
        />
      </View>

      {/* Summary Statistics */}
      {data.length > 0 && (
        <ThemedView
          card
          style={[
            styles.summaryCard,
            {
              borderColor: Colors[colorScheme].cardBorder,
              backgroundColor: Colors[colorScheme].card,
            },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Ionicons
              name="analytics-outline"
              size={20}
              color={Colors[colorScheme].tint}
            />
            <ThemedText type="defaultSemiBold" style={styles.summaryTitle}>
              Summary Statistics
            </ThemedText>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Data Points</ThemedText>
              <ThemedText style={styles.summaryValue}>{data.length}</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Time Range</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {TIME_RANGES.find((r) => r.value === timeRange)?.label || "6h"}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Avg Temp</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {statistics.temperature.avg}°C
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryLabel}>Avg Humidity</ThemedText>
              <ThemedText style={styles.summaryValue}>
                {statistics.humidity.avg}%
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      )}

      {/* Insights & Alerts */}
      {data.length > 0 && (
        <ThemedView
          card
          style={[
            styles.insightsCard,
            {
              borderColor: Colors[colorScheme].cardBorder,
              backgroundColor: Colors[colorScheme].card,
            },
          ]}
        >
          <View style={styles.insightsHeader}>
            <Ionicons
              name="bulb-outline"
              size={20}
              color={Colors[colorScheme].tint}
            />
            <ThemedText type="defaultSemiBold" style={styles.insightsTitle}>
              Insights
            </ThemedText>
          </View>
          <View style={styles.insightsList}>
            {statistics.temperature.trend !== 0 && (
              <View style={styles.insightItem}>
                <Ionicons
                  name={
                    statistics.temperature.trend > 0
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
                  color={
                    statistics.temperature.trend > 0 ? "#FF6B6B" : "#4FC3F7"
                  }
                />
                <ThemedText style={styles.insightText}>
                  Temperature is{" "}
                  {statistics.temperature.trend > 0 ? "rising" : "falling"} by{" "}
                  {Math.abs(statistics.temperature.trend).toFixed(1)}°C
                </ThemedText>
              </View>
            )}
            {statistics.humidity.trend !== 0 && (
              <View style={styles.insightItem}>
                <Ionicons
                  name={
                    statistics.humidity.trend > 0
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
                  color={statistics.humidity.trend > 0 ? "#4FC3F7" : "#FFA726"}
                />
                <ThemedText style={styles.insightText}>
                  Humidity is{" "}
                  {statistics.humidity.trend > 0 ? "increasing" : "decreasing"}{" "}
                  by {Math.abs(statistics.humidity.trend).toFixed(1)}%
                </ThemedText>
              </View>
            )}
            {parseFloat(statistics.temperature.current) > 30 && (
              <View style={[styles.insightItem, styles.alertItem]}>
                <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                <ThemedText style={[styles.insightText, { color: "#FF6B6B" }]}>
                  High temperature detected
                </ThemedText>
              </View>
            )}
            {parseFloat(statistics.humidity.current) < 30 && (
              <View style={[styles.insightItem, styles.alertItem]}>
                <Ionicons name="warning-outline" size={16} color="#FFA726" />
                <ThemedText style={[styles.insightText, { color: "#FFA726" }]}>
                  Low humidity level
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      )}

      {/* Sensor History Chart */}
      <ThemedView
        card
        style={[
          styles.chartCard,
          {
            borderColor: Colors[colorScheme].cardBorder,
            backgroundColor: Colors[colorScheme].card,
          },
        ]}
      >
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <Ionicons
              name="stats-chart-outline"
              size={20}
              color={Colors[colorScheme].tint}
            />
            <ThemedText type="defaultSemiBold" style={styles.chartTitle}>
              Sensor History
            </ThemedText>
          </View>
          <View style={styles.chartFilters}>
            <TouchableOpacity
              onPress={() => setSelectedChartSensor(null)}
              style={[
                styles.chartFilterButton,
                selectedChartSensor === null && styles.chartFilterActive,
                {
                  backgroundColor:
                    selectedChartSensor === null
                      ? Colors[colorScheme].tint
                      : "transparent",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chartFilterText,
                  selectedChartSensor === null && { color: "#FFFFFF" },
                ]}
              >
                All
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedChartSensor("temperature")}
              style={[
                styles.chartFilterButton,
                selectedChartSensor === "temperature" &&
                  styles.chartFilterActive,
                {
                  backgroundColor:
                    selectedChartSensor === "temperature"
                      ? "#FF6B6B"
                      : "transparent",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chartFilterText,
                  selectedChartSensor === "temperature" && { color: "#FFFFFF" },
                ]}
              >
                Temp
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedChartSensor("humidity")}
              style={[
                styles.chartFilterButton,
                selectedChartSensor === "humidity" && styles.chartFilterActive,
                {
                  backgroundColor:
                    selectedChartSensor === "humidity"
                      ? "#4FC3F7"
                      : "transparent",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chartFilterText,
                  selectedChartSensor === "humidity" && { color: "#FFFFFF" },
                ]}
              >
                Humid
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedChartSensor("light")}
              style={[
                styles.chartFilterButton,
                selectedChartSensor === "light" && styles.chartFilterActive,
                {
                  backgroundColor:
                    selectedChartSensor === "light" ? "#FFA726" : "transparent",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chartFilterText,
                  selectedChartSensor === "light" && { color: "#FFFFFF" },
                ]}
              >
                Light
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {data.length === 0 ? (
          <View style={styles.emptyChart}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={Colors[colorScheme].icon}
            />
            <ThemedText style={styles.emptyChartText}>
              No data available
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContainer}
          >
            <LineChart
              data={chartData}
              width={Math.max(Dimensions.get("window").width - 80, 300)}
              height={220}
              chartConfig={{
                backgroundColor: Colors[colorScheme].card,
                backgroundGradientFrom: Colors[colorScheme].card,
                backgroundGradientTo: Colors[colorScheme].card,
                decimalPlaces: 1,
                color: (opacity = 1) =>
                  colorScheme === "dark"
                    ? `rgba(255, 255, 255, ${opacity})`
                    : `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) =>
                  colorScheme === "dark"
                    ? `rgba(255, 255, 255, ${opacity})`
                    : `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: colorScheme === "dark" ? "#2D2D2D" : "#E1E4E8",
                  strokeWidth: 1,
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={true}
              withShadow={false}
              segments={4}
            />
          </ScrollView>
        )}

        {/* Legend */}
        {data.length > 0 && (
          <View style={styles.chartLegend}>
            {(selectedChartSensor === null ||
              selectedChartSensor === "temperature") && (
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#FF6B6B" }]}
                />
                <ThemedText style={styles.legendText}>Temperature</ThemedText>
              </View>
            )}
            {(selectedChartSensor === null ||
              selectedChartSensor === "humidity") && (
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#4FC3F7" }]}
                />
                <ThemedText style={styles.legendText}>Humidity</ThemedText>
              </View>
            )}
            {(selectedChartSensor === null ||
              selectedChartSensor === "light") && (
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#FFA726" }]}
                />
                <ThemedText style={styles.legendText}>Light (×10)</ThemedText>
              </View>
            )}
          </View>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  bgColor,
  stats,
  unit,
  colorScheme,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  bgColor: string;
  stats: {
    current: string;
    min: string;
    max: string;
    avg: string;
    trend: number;
  };
  unit: string;
  colorScheme: "light" | "dark";
}) {
  const hasTrend = stats.trend !== 0 && stats.current !== "--";
  const trendUp = stats.trend > 0;

  return (
    <ThemedView
      card
      style={[
        styles.statCard,
        {
          borderColor: Colors[colorScheme].cardBorder,
          backgroundColor: bgColor,
        },
      ]}
    >
      <View
        style={[
          styles.statIconContainer,
          {
            backgroundColor:
              colorScheme === "dark" ? `${color}30` : `${color}20`,
          },
        ]}
      >
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <ThemedText type="defaultSemiBold" style={styles.statLabel}>
        {label}
      </ThemedText>
      <View style={styles.statValueContainer}>
        <Text style={[styles.statValue, { color: color }]}>{value}</Text>
        {hasTrend && (
          <Ionicons
            name={trendUp ? "arrow-up" : "arrow-down"}
            size={14}
            color={trendUp ? "#4CAF50" : "#FF6B6B"}
            style={styles.trendIcon}
          />
        )}
      </View>
      {stats.current !== "--" && (
        <View style={styles.statDetails}>
          <View style={styles.statDetailRow}>
            <ThemedText style={styles.statDetailLabel}>Avg:</ThemedText>
            <ThemedText style={styles.statDetailValue}>
              {stats.avg}
              {unit}
            </ThemedText>
          </View>
          <View style={styles.statDetailRow}>
            <ThemedText style={styles.statDetailLabel}>Range:</ThemedText>
            <ThemedText style={styles.statDetailValue}>
              {stats.min}
              {unit} - {stats.max}
              {unit}
            </ThemedText>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    position: "absolute",
    bottom: -90,
    left: -40,
    opacity: 0.9,
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  statCard: {
    width: "47%",
    minHeight: 180,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statLabel: {
    marginBottom: 6,
    opacity: 0.7,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
    flexShrink: 1,
    minHeight: 30,
  },
  trendIcon: {
    marginTop: 2,
  },
  statDetails: {
    width: "100%",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: 4,
  },
  statDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statDetailLabel: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: "500",
  },
  statDetailValue: {
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.8,
  },
  insightsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  alertItem: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.2)",
  },
  insightText: {
    fontSize: 13,
    flex: 1,
    opacity: 0.8,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: "500",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    opacity: 0.9,
  },
  controlsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  controlsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  controlsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  controlsTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsContent: {
    gap: 16,
  },
  controlGroup: {
    gap: 10,
  },
  controlLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 50,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: "500",
  },
  pickerDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  pickerOptionText: {
    fontSize: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.7,
  },
  dataInfo: {
    alignItems: "flex-end",
    gap: 4,
  },
  dataCount: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.6,
  },
  lastUpdate: {
    fontSize: 11,
    opacity: 0.5,
    fontWeight: "500",
  },
  chartCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    marginBottom: 16,
    gap: 12,
  },
  chartHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chartFilters: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chartFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  chartFilterActive: {
    borderColor: "transparent",
  },
  chartFilterText: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.8,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  chartScrollContainer: {
    paddingVertical: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  emptyChart: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyChartText: {
    fontSize: 14,
    opacity: 0.6,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: "500",
  },
});
