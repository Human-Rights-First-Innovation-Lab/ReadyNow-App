import React from "react";
import { View } from "react-native";

import { FAQList } from "./FAQList";

const FAQTab: React.FC = () => {
  return (
    <View className="flex-1">
      <FAQList
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 16,
        }}
      />
    </View>
  );
};

export default FAQTab;
