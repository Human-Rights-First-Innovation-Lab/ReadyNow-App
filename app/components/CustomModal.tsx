import React from "react";
import { Modal, Text, TouchableOpacity, View, Platform } from "react-native";

interface ButtonProps {
  text: string;
  onPress: () => void;
  type: "primary" | "secondary" | "danger";
}

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttons: ButtonProps[];
  animationType?: "none" | "slide" | "fade";
  footer?: React.ReactNode;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  title,
  message,
  onClose,
  buttons,
  animationType = "fade",
  footer,
}) => {
  const getButtonClass = (type: ButtonProps["type"]) => {
    switch (type) {
      case "primary":
        return "bg-[#6776cc]";
      case "danger":
        return "bg-[#FF3B30]";
      case "secondary":
      default:
        return "bg-[#f0f0f2]";
    }
  };

  const getTextClass = (type: ButtonProps["type"]) => {
    switch (type) {
      case "primary":
      case "danger":
        return "text-white";
      case "secondary":
      default:
        return "text-[#60646c]";
    }
  };

  // For web, use a custom implementation since React Native Modal can have issues
  if (Platform.OS === "web" && visible) {
    return (
      <View
        style={{
          position: "fixed" as any, // Web-only: fixed positioning for overlay
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
        } as any}
      >
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            width: "85%",
            maxWidth: 400,
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              textAlign: "center",
              color: "black",
              marginBottom: 16,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 16,
              textAlign: "center",
              color: "#666",
              marginBottom: 20,
            }}
          >
            {message}
          </Text>

          <View style={{ width: "100%", gap: 12 }}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor:
                    button.type === "primary"
                      ? "#6776cc"
                      : button.type === "danger"
                      ? "#FF3B30"
                      : "#f0f0f2",
                  borderRadius: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  width: "100%",
                  alignItems: "center",
                }}
                onPress={button.onPress}
              >
                <Text
                  style={{
                    color: button.type === "secondary" ? "#60646c" : "white",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {footer && <View style={{ marginTop: 8 }}>{footer}</View>}
        </View>
      </View>
    );
  }

  // Return null if not visible on web
  if (Platform.OS === "web" && !visible) {
    return null;
  }

  // Native modal implementation
  return (
    <Modal
      animationType={animationType}
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-center items-center bg-black/50"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1000,
        }}
      >
        <View
          className="w-[85%] bg-white rounded-xl p-6 shadow-md"
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            zIndex: 1001,
          }}
        >
          <Text className="text-xl font-bold text-center text-black mb-4">
            {title}
          </Text>
          <Text className="text-base text-center text-gray-600 mb-5">
            {message}
          </Text>

          <View className="w-full space-y-3">
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                className={`${getButtonClass(
                  button.type
                )} rounded-lg py-3 px-4 w-full items-center`}
                onPress={button.onPress}
              >
                <Text
                  className={`${getTextClass(
                    button.type
                  )} font-bold text-center`}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {footer && <View className="mt-2">{footer}</View>}
        </View>
      </View>
    </Modal>
  );
};

// Add a default export while maintaining the named export for compatibility
export default CustomModal;
