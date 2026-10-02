import React from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import AlertButton from "./AlertButton";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

interface AlertTabProps {
  onAlertPress: () => void;
  isDemoMode?: boolean;
}

const AlertTab: React.FC<AlertTabProps> = ({ onAlertPress, isDemoMode = false }) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("alert-tab", settings.language);
  const { width, height } = useWindowDimensions();

  // Determine if we're on a small screen (width < 360px is typical for small devices)
  const isSmallScreen = width < 360 || height < 640;

  // Scale values based on screen size - make button even smaller for small screens
  // const logoWidth = isSmallScreen ? 120 : 250;
  const logoHeight = isSmallScreen ? 40 : 120;
  const buttonSize = isSmallScreen ? 90 : 185;
  const iconSize = isSmallScreen ? 12 : 18;

  return (
    <View className="flex-1 ">
      {isDemoMode && (
        <View className="bg-green-500 px-4 py-2">
          <Text className="text-white text-center font-semibold">
            {t("demoModeLabel")}
          </Text>
        </View>
      )}
      <View
        className={"items-center justify-center"}
      >
        <Image
          source={require("../../assets/images/main-screen-logo-updated.png")}
          style={{  height: logoHeight }}
          resizeMode="contain"
        />
      </View>

      <Text
        className={`${
          isSmallScreen ? "px-1 pb-1 text-xs" : "px-4 pb-4 text-lg"
        } text-center text-gray-600 z-10`}
      >
        {isDemoMode ? t("pressAndHoldDemo") : t("pressAndHold")}
      </Text>

      <View className="flex-1 justify-center items-center">
        <AlertButton onPress={onAlertPress} size={buttonSize} isDemoMode={isDemoMode} />
      </View>

      <View
        className={`border border-gray-200 ${
          isSmallScreen ? "m-2 p-1" : "m-8 p-2"
        }`}
      >
        <View className="flex-row items-center justify-center">
          <Text
            className={`text-center ${
              isSmallScreen ? "text-xs" : "text-md"
            } font-bold text-gray-600 mr-1`}
          >
            {t("notice")}
          </Text>
          <MaterialIcons
            name="info"
            size={iconSize}
            color="#60646c"
            className="mx-4"
          />
        </View>

        <Text
          className={`text-center ${
            isSmallScreen ? "text-xs" : "text-md"
          } text-gray-600`}
        >
          {isDemoMode ? t("securityPurposesDemo") : t("securityPurposes")}
        </Text>
      </View>
    </View>
  );
};

export default AlertTab;
