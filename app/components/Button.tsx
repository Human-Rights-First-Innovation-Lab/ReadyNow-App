import type { ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";

interface ButtonProps {
  text?: string;
  onPress?: () => void;
  navigateTo?: string;
  params?: object;
  style?: object;
  textStyle?: object;
  disabled?: boolean;
  activeOpacity?: number;
  className?: string;
  hitSlop?: object;
}

const Button: React.FC<ButtonProps> = ({
  text = "Button", // Default text
  onPress, // Callback function (optional)
  navigateTo, // Screen to navigate to (optional)
  params = {}, // Navigation params
  style = {}, // Container style
  textStyle = {}, // Text style
  disabled = false, // Disabled state
  activeOpacity = 0.7, // Touch opacity
  className = "", // Additional class name
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 }, // Default hit slop
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const handlePress = () => {
    if (disabled) return;

    if (navigateTo) {
      navigation.navigate(navigateTo, params);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={handlePress}
      activeOpacity={activeOpacity}
      disabled={disabled}
      className={className}
      hitSlop={hitSlop}
    >
      <Text style={[styles.text, disabled && styles.disabledText, textStyle]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#6776cc",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  text: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    backgroundColor: "#cccccc",
    elevation: 0,
    shadowOpacity: 0,
  },
  disabledText: {
    color: "#888888",
  },
});

export default Button;
