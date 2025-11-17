import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  deviceControl,
  exportData,
  getDeviceSettings,
  getDeviceStatus,
  triggerImmediateRead,
  updateAlertThresholds,
  updateCalibration,
  updateSamplingInterval,
  type DeviceSettings,
  type DeviceStatus,
} from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsTab() {
  const [interval, setInterval] = useState<string>("30");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings | null>(
    null
  );
  const [tempOffset, setTempOffset] = useState<string>("0");
  const [humidityOffset, setHumidityOffset] = useState<string>("0");
  const [lightThreshold, setLightThreshold] = useState<string>("512");
  const [tempMin, setTempMin] = useState<string>("10");
  const [tempMax, setTempMax] = useState<string>("35");
  const [humidityMin, setHumidityMin] = useState<string>("30");
  const [humidityMax, setHumidityMax] = useState<string>("80");
  const colorScheme = useColorScheme() ?? "light";

  const loadData = async () => {
    try {
      setLoading(true);
      // Try to fetch both, but handle errors gracefully
      const results = await Promise.allSettled([
        getDeviceStatus(),
        getDeviceSettings(),
      ]);
      
      // Handle device status
      if (results[0].status === "fulfilled") {
        setDeviceStatus(results[0].value);
      } else {
        console.error("Failed to load device status:", results[0].reason);
      }
      
      // Handle device settings
      if (results[1].status === "fulfilled") {
        const settings = results[1].value;
        setDeviceSettings(settings);
        if (settings) {
          setTempOffset(settings.temperatureOffset.toString());
          setHumidityOffset(settings.humidityOffset.toString());
          setLightThreshold(settings.lightThreshold.toString());
          setTempMin(settings.alertThresholds.temperature.min.toString());
          setTempMax(settings.alertThresholds.temperature.max.toString());
          setHumidityMin(settings.alertThresholds.humidity.min.toString());
          setHumidityMax(settings.alertThresholds.humidity.max.toString());
        }
      } else {
        console.error("Failed to load device settings:", results[1].reason);
        // Use default values if settings fail to load
        if (!deviceSettings) {
          setDeviceSettings({
            temperatureOffset: 0,
            humidityOffset: 0,
            lightThreshold: 512,
            alertThresholds: {
              temperature: { min: 10, max: 35 },
              humidity: { min: 30, max: 80 },
              light: { min: 0, max: 1023 },
            },
            autoReconnect: true,
            debugMode: false,
          });
        }
      }
    } catch (e: any) {
      console.error("Error loading data:", e);
      Alert.alert("Connection Error", e?.message || "Failed to connect to server. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const onSaveInterval = async () => {
    const seconds = Number(interval);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      Alert.alert("Invalid interval", "Enter a number greater than 0");
      return;
    }
    try {
      await updateSamplingInterval(Math.floor(seconds));
      Alert.alert("Saved", `Sampling interval set to ${Math.floor(seconds)}s`);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update interval");
    }
  };

  const onRead = async () => {
    try {
      await triggerImmediateRead();
      Alert.alert("Success", "Immediate read requested");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to trigger read");
    }
  };

  const onSaveCalibration = async () => {
    try {
      await updateCalibration(
        parseFloat(tempOffset) || 0,
        parseFloat(humidityOffset) || 0,
        parseInt(lightThreshold) || 512
      );
      Alert.alert("Success", "Calibration settings saved");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update calibration");
    }
  };

  const onSaveThresholds = async () => {
    try {
      await updateAlertThresholds(
        {
          min: parseFloat(tempMin) || 10,
          max: parseFloat(tempMax) || 35,
        },
        {
          min: parseFloat(humidityMin) || 30,
          max: parseFloat(humidityMax) || 80,
        }
      );
      Alert.alert("Success", "Alert thresholds saved");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update thresholds");
    }
  };

  const onDeviceControl = async (
    action: "led_on" | "led_off" | "reset" | "restart"
  ) => {
    try {
      const result = await deviceControl(action);
      Alert.alert("Success", result.message);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send command");
    }
  };

  const onExportData = async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7); // Last 7 days
      const csv = await exportData(start, end);
      Alert.alert(
        "Export",
        `Data exported (${csv.split("\n").length - 1} rows)`
      );
      // In a real app, you'd save this to a file
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to export data");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#E3F2FD", dark: "#1A2332" }}
      headerImage={
        <Ionicons
          size={200}
          color={colorScheme === "dark" ? "#4FC3F7" : "#1E88E5"}
          name="settings-outline"
          style={styles.headerImage}
        />
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Settings</ThemedText>
      </ThemedView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      ) : (
        <>
          {/* Device Status */}
          {deviceStatus && (
            <ThemedView
              card
              style={[
                styles.card,
                { borderColor: Colors[colorScheme].cardBorder },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={20}
                  color={Colors[colorScheme].tint}
                />
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  Device Status
                </ThemedText>
              </View>
              <View style={styles.statusGrid}>
                <View style={styles.statusItem}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: deviceStatus.connected
                          ? "#4CAF50"
                          : "#FF6B6B",
                      },
                    ]}
                  />
                  <ThemedText style={styles.statusLabel}>
                    {deviceStatus.connected ? "Connected" : "Disconnected"}
                  </ThemedText>
                </View>
                <View style={styles.statusItem}>
                  <ThemedText style={styles.statusLabel}>Uptime:</ThemedText>
                  <ThemedText style={styles.statusValue}>
                    {formatUptime(deviceStatus.uptime)}
                  </ThemedText>
                </View>
                <View style={styles.statusItem}>
                  <ThemedText style={styles.statusLabel}>Readings:</ThemedText>
                  <ThemedText style={styles.statusValue}>
                    {deviceStatus.totalReadings}
                  </ThemedText>
                </View>
                <View style={styles.statusItem}>
                  <ThemedText style={styles.statusLabel}>Port:</ThemedText>
                  <ThemedText style={styles.statusValue}>
                    {deviceStatus.serialPort}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
          )}

          {/* Sampling Interval */}
          <ThemedView
            card
            style={[
              styles.card,
              { borderColor: Colors[colorScheme].cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="time-outline"
                size={20}
                color={Colors[colorScheme].tint}
              />
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Data Collection
              </ThemedText>
            </View>
            <ThemedText style={styles.label}>
              Sampling interval (seconds)
            </ThemedText>
            <ThemedTextInput
              value={interval}
              onChangeText={setInterval}
              keyboardType="number-pad"
              placeholder="30"
              style={styles.input}
            />
            <View style={styles.row}>
              <ThemedButton
                label="Save Interval"
                onPress={onSaveInterval}
                colorScheme={colorScheme}
              />
              <ThemedButton
                label="Read Now"
                onPress={onRead}
                colorScheme={colorScheme}
              />
            </View>
          </ThemedView>

          {/* Sensor Calibration */}
          <ThemedView
            card
            style={[
              styles.card,
              { borderColor: Colors[colorScheme].cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="construct-outline"
                size={20}
                color={Colors[colorScheme].tint}
              />
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Sensor Calibration
              </ThemedText>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Temp Offset (°C)</ThemedText>
                <ThemedTextInput
                  value={tempOffset}
                  onChangeText={setTempOffset}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>
                  Humidity Offset (%)
                </ThemedText>
                <ThemedTextInput
                  value={humidityOffset}
                  onChangeText={setHumidityOffset}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Light Threshold</ThemedText>
              <ThemedTextInput
                value={lightThreshold}
                onChangeText={setLightThreshold}
                keyboardType="number-pad"
                placeholder="512"
                style={styles.input}
              />
            </View>
            <ThemedButton
              label="Save Calibration"
              onPress={onSaveCalibration}
              colorScheme={colorScheme}
            />
          </ThemedView>

          {/* Alert Thresholds */}
          <ThemedView
            card
            style={[
              styles.card,
              { borderColor: Colors[colorScheme].cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="warning-outline"
                size={20}
                color={Colors[colorScheme].tint}
              />
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Alert Thresholds
              </ThemedText>
            </View>
            <View style={styles.thresholdSection}>
              <ThemedText style={styles.sectionLabel}>
                Temperature (°C)
              </ThemedText>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Min</ThemedText>
                  <ThemedTextInput
                    value={tempMin}
                    onChangeText={setTempMin}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Max</ThemedText>
                  <ThemedTextInput
                    value={tempMax}
                    onChangeText={setTempMax}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
            <View style={styles.thresholdSection}>
              <ThemedText style={styles.sectionLabel}>Humidity (%)</ThemedText>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Min</ThemedText>
                  <ThemedTextInput
                    value={humidityMin}
                    onChangeText={setHumidityMin}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Max</ThemedText>
                  <ThemedTextInput
                    value={humidityMax}
                    onChangeText={setHumidityMax}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
            <ThemedButton
              label="Save Thresholds"
              onPress={onSaveThresholds}
              colorScheme={colorScheme}
            />
          </ThemedView>

          {/* Device Control */}
          <ThemedView
            card
            style={[
              styles.card,
              { borderColor: Colors[colorScheme].cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="flash-outline"
                size={20}
                color={Colors[colorScheme].tint}
              />
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Device Control
              </ThemedText>
            </View>
            <View style={styles.controlGrid}>
              <TouchableOpacity
                onPress={() => onDeviceControl("led_on")}
                style={[styles.controlButton, { backgroundColor: "#4CAF50" }]}
              >
                <Ionicons name="bulb" size={20} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>LED On</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeviceControl("led_off")}
                style={[styles.controlButton, { backgroundColor: "#757575" }]}
              >
                <Ionicons name="bulb-outline" size={20} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>LED Off</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeviceControl("reset")}
                style={[styles.controlButton, { backgroundColor: "#FFA726" }]}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeviceControl("restart")}
                style={[styles.controlButton, { backgroundColor: "#FF6B6B" }]}
              >
                <Ionicons name="power" size={20} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>Restart</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Data Export */}
          <ThemedView
            card
            style={[
              styles.card,
              { borderColor: Colors[colorScheme].cardBorder },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="download-outline"
                size={20}
                color={Colors[colorScheme].tint}
              />
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Data Export
              </ThemedText>
            </View>
            <ThemedText style={styles.description}>
              Export sensor data from the last 7 days as CSV
            </ThemedText>
            <ThemedButton
              label="Export Data"
              onPress={onExportData}
              colorScheme={colorScheme}
            />
          </ThemedView>
        </>
      )}
    </ParallaxScrollView>
  );
}

function ThemedButton({
  label,
  onPress,
  disabled,
  colorScheme,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colorScheme: "light" | "dark";
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: Colors[colorScheme].button,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      activeOpacity={0.8}
    >
      <ThemedText
        type="defaultSemiBold"
        style={{ color: Colors[colorScheme].buttonText }}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    position: "absolute",
    bottom: -50,
    left: -30,
    opacity: 0.9,
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.7,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 12,
  },
  input: {
    marginTop: 0,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusGrid: {
    gap: 12,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 14,
    opacity: 0.7,
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  thresholdSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  controlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  controlButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  controlButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
