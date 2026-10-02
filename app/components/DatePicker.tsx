import React, { useState } from "react";
import { Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

interface DatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Maps app language codes to BCP 47 locale codes for date formatting
 */
const getLocaleFromLanguage = (language: string): string => {
  const localeMap: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    kr: "ko-KR",
    fr: "fr-FR",
    ht: "ht-HT",
    zh: "zh-CN",
    ar: "ar-SA",
  };
  return localeMap[language] || "en-US";
};

/**
 * Formats a Date object to a readable string using the specified locale
 */
const formatDateForDisplay = (date: Date, language: string): string => {
  return date.toLocaleDateString(getLocaleFromLanguage(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Converts ISO date string (YYYY-MM-DD) to Date object
 */
const isoStringToDate = (isoString: string): Date => {
  if (!isoString) {
    return new Date();
  }
  const date = new Date(isoString + "T00:00:00");
  return isNaN(date.getTime()) ? new Date() : date;
};

/**
 * Converts Date object to ISO date string (YYYY-MM-DD)
 */
const dateToIsoString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onValueChange,
  placeholder,
  className = "",
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("date-picker", settings.language);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => isoStringToDate(value));

  const displayDate = value
    ? formatDateForDisplay(isoStringToDate(value), settings.language)
    : placeholder || t("selectDatePlaceholder");

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setModalVisible(false);
      if (selectedDate) {
        const isoString = dateToIsoString(selectedDate);
        onValueChange(isoString);
      }
    } else {
      // iOS: Update temp date, user confirms with "Done" button
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    const isoString = dateToIsoString(tempDate);
    onValueChange(isoString);
    setModalVisible(false);
  };

  const handleCancel = () => {
    // Reset temp date to current value
    setTempDate(isoStringToDate(value));
    setModalVisible(false);
  };

  return (
    <View testID="date-picker">
      {/* Date picker trigger button */}
      <TouchableOpacity
        testID="date-picker-button"
        onPress={() => {
          setTempDate(isoStringToDate(value));
          setModalVisible(true);
        }}
        className={`flex-row items-center justify-between rounded-md border border-gray-300 bg-white p-3 ${className}`}
      >
        <Text className={`text-base ${value ? "text-gray-800" : "text-gray-500"}`}>
          {displayDate}
        </Text>
        <Text className="text-gray-500">▼</Text>
      </TouchableOpacity>

      {/* Modal for date picker */}
      {Platform.OS === "ios" ? (
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="rounded-t-xl bg-white pb-8">
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
                <TouchableOpacity onPress={handleCancel}>
                  <Text className="text-base text-gray-600">{t("cancel")}</Text>
                </TouchableOpacity>
                <Text className="text-lg font-medium">{t("selectDate")}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text className="text-base font-medium text-blue-500">{t("done")}</Text>
                </TouchableOpacity>
              </View>

              {/* Date picker */}
              <View className="p-4">
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor="#000000"
                  themeVariant="light"
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        // Android: Native picker (no modal needed)
        modalVisible && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )
      )}
    </View>
  );
};

export default DatePicker;

