import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getSensorDataByRange, type SensorData } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

export default function DashboardTab() {
  const [data, setData] = useState<SensorData[]>([]);

  const fetchData = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setHours(start.getHours() - 6);
      const readings = await getSensorDataByRange(start, end, 100);
      setData(readings);
    } catch {
      setData([]);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const latest = data[0];
  const summary = useMemo(() => {
    if (!latest) {
      return { temperature: "--°C", humidity: "--%", light: "--" };
    }
    return {
      temperature: `${latest.temperature.toFixed(1)}°C`,
      humidity: `${latest.humidity.toFixed(1)}%`,
      light: `${latest.ldr}`,
    };
  }, [latest]);
  const rows = (
    data.length
      ? data
      : Array.from({ length: 8 }).map((_, i) => ({
          id: String(i),
          timestamp: new Date().toISOString(),
          temperature: NaN,
          humidity: NaN,
          ldr: NaN,
        }))
  ).slice(0, 8);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#E8F5E9", dark: "#0E1A12" }}
      headerImage={
        <IconSymbol
          size={300}
          color="#34A853"
          name="chart.xyaxis.line"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Dashboard</ThemedText>
      </ThemedView>

      {/* Controls (UI only) */}
      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Data Controls</ThemedText>
        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <ThemedText>Time Range</ThemedText>
            <TextInput
              editable={false}
              value="Last 6 Hours"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText>Sampling Interval (seconds)</ThemedText>
            <TextInput editable={false} value="30" style={styles.input} />
          </View>
        </View>
      </ThemedView>

      <View style={styles.cardsContainer}>
        <StatCard label="Temperature" value={summary.temperature} />
        <StatCard label="Humidity" value={summary.humidity} />
        <StatCard label="Light" value={summary.light} />
      </View>

      {/* Chart placeholder */}
      <ThemedView style={[styles.card, { height: 220 }]}>
        <ThemedText type="defaultSemiBold">Sensor History</ThemedText>
        <View style={styles.chartPlaceholder} />
        <ThemedText style={{ opacity: 0.6 }}>
          Chart placeholder (UI only)
        </ThemedText>
      </ThemedView>

      <ThemedText type="subtitle" style={{ marginTop: 16 }}>
        Recent readings
      </ThemedText>
      <View style={styles.listContainer}>
        {rows.map((item, idx) => (
          <ThemedView key={`${item.timestamp}-${idx}`} style={styles.row}>
            <ThemedText style={styles.rowPrimary}>
              {isNaN(Number(item.temperature))
                ? "--:--:--"
                : new Date(item.timestamp).toLocaleTimeString()}
            </ThemedText>
            <ThemedText>
              {isNaN(Number(item.temperature))
                ? "--°C"
                : `${Number(item.temperature).toFixed(1)}°C`}
            </ThemedText>
            <ThemedText>
              {isNaN(Number(item.humidity))
                ? "--%"
                : `${Number(item.humidity).toFixed(1)}%`}
            </ThemedText>
            <ThemedText>
              {isNaN(Number(item.ldr)) ? "--" : String(item.ldr)}
            </ThemedText>
          </ThemedView>
        ))}
      </View>
    </ParallaxScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.card}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText type="title">{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  cardsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  chartPlaceholder: {
    flex: 1,
    borderRadius: 10,
    marginVertical: 8,
  },
  listContainer: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowPrimary: {
    width: 120,
  },
});
