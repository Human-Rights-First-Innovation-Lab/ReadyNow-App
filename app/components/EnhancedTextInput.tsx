import React, { useRef, forwardRef } from "react";
import {
  TextInput,
  TextInputProps,
  InputAccessoryView,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Keyboard,
} from "react-native";

interface EnhancedTextInputProps extends TextInputProps {
  showDoneButton?: boolean;
  doneButtonText?: string;
  onDone?: () => void;
}

/**
 * Enhanced TextInput that automatically adds a Done button on iOS for keyboards
 * that don't have one (like phone-pad and number-pad)
 */
export const EnhancedTextInput = forwardRef<TextInput, EnhancedTextInputProps>(({
  showDoneButton = true,
  doneButtonText = "Done",
  onDone,
  keyboardType,
  ...props
}, ref) => {
  // Generate a unique ID for this specific input instance
  const inputAccessoryViewID = useRef(`input-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`).current;
  
  const handleDone = () => {
    if (onDone) {
      onDone();
    } else {
      Keyboard.dismiss();
    }
  };

  // Determine if we should show the custom done button
  // For keyboards without a native done button (phone-pad, number-pad, etc.)
  const needsCustomDoneButton = 
    props.multiline ||
    keyboardType === "phone-pad" || 
    keyboardType === "number-pad" || 
    keyboardType === "decimal-pad" ||
    keyboardType === "numeric";

  // Only show custom accessory on iOS when needed and enabled
  const shouldShowCustomAccessory = Platform.OS === "ios" && 
    showDoneButton && 
    needsCustomDoneButton;
  
  // For multiline inputs, use 'default' return key so user can add new lines
  // For single-line inputs, use 'done' to dismiss keyboard
  const effectiveReturnKeyType = props.multiline 
    ? (props.returnKeyType || "default")
    : (props.returnKeyType || "done");
  
  // For multiline, never blur on submit (allows new lines)
  // For single-line, blur on submit (dismisses keyboard)
  const effectiveBlurOnSubmit = props.blurOnSubmit !== undefined 
    ? props.blurOnSubmit 
    : !props.multiline;

  return (
    <>
      <TextInput
        ref={ref}
        {...props}
        keyboardType={keyboardType}
        returnKeyType={effectiveReturnKeyType}
        blurOnSubmit={effectiveBlurOnSubmit}
        inputAccessoryViewID={shouldShowCustomAccessory ? inputAccessoryViewID : undefined}
      />
      
      {shouldShowCustomAccessory && (
        <InputAccessoryView nativeID={inputAccessoryViewID}>
          <View className="flex-row justify-end items-center bg-gray-200 border-t border-gray-300 px-4 py-2">
            <TouchableOpacity onPress={handleDone}>
              <Text className="text-blue-600 font-medium text-base">
                {doneButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
});

EnhancedTextInput.displayName = "EnhancedTextInput";
