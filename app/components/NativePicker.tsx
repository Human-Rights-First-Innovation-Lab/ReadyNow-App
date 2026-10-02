import * as React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";

interface PickerItem {
  label: string;
  value: string;
}

interface NativePickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  placeholder?: string;
}

export const NativePicker: React.FC<NativePickerProps> = ({
  selectedValue,
  onValueChange,
  items,
  placeholder = "Select an option",
}: NativePickerProps) => {
  if (Platform.OS === "ios") {
    return (
      <View style={styles.iosContainer}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          style={styles.iosPicker}
          itemStyle={styles.iosPickerItem}
        >
          {items.map((item) => (
            <Picker.Item
              key={item.value}
              label={item.label}
              value={item.value}
            />
          ))}
        </Picker>
      </View>
    );
  }

  // Android styling
  return (
    <View style={styles.androidContainer}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={styles.androidPicker}
        dropdownIconColor="#5a69cc"
      >
        {!selectedValue && (
          <Picker.Item label={placeholder} value="" enabled={false} />
        )}
        {items.map((item) => (
          <Picker.Item
            key={item.value}
            label={item.label}
            value={item.value}
          />
        ))}
      </Picker>
    </View>
  );
};

const styles = StyleSheet.create({
  iosContainer: {
    backgroundColor: "#ffffff", // Changed to white for better contrast
    borderRadius: 8,
    marginVertical: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0", // Added border for definition
  },
  iosPicker: {
    height: 150,
  },
  iosPickerItem: {
    fontSize: 18,
    height: 150, // Changed from 150px to 40px to prevent visual jumping
    color: "#000000", // Ensure text is black on iOS
  },
  androidContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    marginVertical: 10,
  },
  androidPicker: {
    height: 50,
    paddingHorizontal: 10,
  },
});

export default NativePicker;
