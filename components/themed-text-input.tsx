import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
  lightBorderColor?: string;
  darkBorderColor?: string;
  lightBackgroundColor?: string;
  darkBackgroundColor?: string;
};

export function ThemedTextInput({
  style,
  lightColor,
  darkColor,
  lightBorderColor,
  darkBorderColor,
  lightBackgroundColor,
  darkBackgroundColor,
  ...rest
}: ThemedTextInputProps) {
  const colorScheme = useColorScheme() ?? "light";
  const textColor =
    lightColor || darkColor
      ? colorScheme === "light"
        ? lightColor
        : darkColor
      : Colors[colorScheme].inputText;
  const borderColor =
    lightBorderColor || darkBorderColor
      ? colorScheme === "light"
        ? lightBorderColor
        : darkBorderColor
      : Colors[colorScheme].inputBorder;
  const backgroundColor =
    lightBackgroundColor || darkBackgroundColor
      ? colorScheme === "light"
        ? lightBackgroundColor
        : darkBackgroundColor
      : Colors[colorScheme].input;

  return (
    <TextInput
      style={[
        styles.input,
        {
          color: textColor,
          borderColor,
          backgroundColor,
        },
        style,
      ]}
      placeholderTextColor={colorScheme === "light" ? "#9CA3AF" : "#6B7280"}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});
