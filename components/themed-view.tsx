import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  card?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  card,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = card
    ? useThemeColor({ light: lightColor, dark: darkColor }, "card")
    : useThemeColor({ light: lightColor, dark: darkColor }, "background");

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
