import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, InputAccessoryView, Platform, Keyboard } from "react-native";

interface KeyboardAccessoryProps {
  inputAccessoryViewID: string;
  onDone?: () => void;
  doneText?: string;
}

export const KeyboardAccessory: React.FC<KeyboardAccessoryProps> = ({ 
  inputAccessoryViewID, 
  onDone,
  doneText = "Done"
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const showListener = Keyboard.addListener("keyboardWillShow", () => {
      setIsVisible(true);
    });
    
    const hideListener = Keyboard.addListener("keyboardWillHide", () => {
      setIsVisible(false);
    });

    // Force re-render to ensure InputAccessoryView is properly registered
    setIsVisible(false);
    setTimeout(() => setIsVisible(true), 100);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  if (Platform.OS !== "ios" || !isVisible) {
    return null;
  }

  const handleDone = () => {
    if (onDone) {
      onDone();
    } else {
      Keyboard.dismiss();
    }
  };

  return (
    <InputAccessoryView nativeID={inputAccessoryViewID}>
      <View className="flex-row justify-end items-center bg-gray-200 border-t border-gray-300 px-4 py-2">
        <TouchableOpacity onPress={handleDone}>
          <Text className="text-blue-600 font-medium text-base">
            {doneText}
          </Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
};

// Hook to generate a unique ID for each input (not form)
export const useKeyboardAccessory = (inputName: string = "input") => {
  // Generate a unique ID for each input to avoid conflicts
  const [inputAccessoryViewID] = useState(`${inputName}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
  return inputAccessoryViewID;
};
