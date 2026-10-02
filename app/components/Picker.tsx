import React, { useState } from "react";
import { FlatList, Modal, Text, TouchableOpacity, View } from "react-native";

interface PickerItem {
  label: string;
  value: string;
}

interface CustomPickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
  placeholder?: string;
}

export const CustomPicker: React.FC<CustomPickerProps> = ({
  selectedValue,
  onValueChange,
  items,
  placeholder = "Select an option",
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Find the selected item to display its label
  const selectedItem = items.find((item) => item.value === selectedValue);
  const displayText = selectedItem ? selectedItem.label : placeholder;

  return (
    <View>
      {/* Picker trigger button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className="flex-row items-center justify-between rounded-md border border-gray-300 bg-white p-3"
      >
        <Text className="text-base text-gray-800">{displayText}</Text>
        <Text className="text-gray-500">▼</Text>
      </TouchableOpacity>

      {/* Modal for picker options */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-xl bg-white pb-16">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
              <Text className="text-lg font-medium">Select an option</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text className="font-medium text-blue-500">Done</Text>
              </TouchableOpacity>
            </View>

            {/* Options list */}
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              className="max-h-80"
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`flex-row items-center justify-between border-b border-gray-100 p-4 ${
                    item.value === selectedValue ? "bg-blue-50" : ""
                  }`}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    className={`text-base ${
                      item.value === selectedValue
                        ? "font-medium text-blue-500"
                        : "text-gray-800"
                    }`}
                  >
                    {item.label}
                  </Text>

                  {item.value === selectedValue && (
                    <Text className="text-lg text-blue-500">✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CustomPicker;
