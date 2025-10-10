import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { triggerImmediateRead, updateSamplingInterval } from "@/lib/api";
import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";

export default function SettingsTab() {
  const [interval, setInterval] = useState<string>("30");

  const onSave = async () => {
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
      Alert.alert("Triggered", "Immediate read requested");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to trigger read");
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#E3F2FD", dark: "#0E141A" }}
      headerImage={
        <IconSymbol
          size={300}
          color="#1E88E5"
          name="gearshape.2"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Settings</ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">
          Sampling interval (seconds)
        </ThemedText>
        <TextInput
          value={interval}
          onChangeText={setInterval}
          keyboardType="number-pad"
          placeholder="30"
          style={styles.input}
        />
        <View style={styles.row}>
          <ThemedButton label="Save" onPress={onSave} />
          <ThemedButton label="Immediate read" onPress={onRead} />
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

function ThemedButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <ThemedView style={[styles.button, disabled && { opacity: 0.6 }]}>
      <ThemedText
        onPress={disabled ? undefined : onPress}
        type="defaultSemiBold"
      >
        {label}
      </ThemedText>
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
  card: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
});
