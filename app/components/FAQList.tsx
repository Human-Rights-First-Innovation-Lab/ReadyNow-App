import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";

export interface FAQItem {
  question: string;
  answer: string;
  additionalAnswer?: string;
  listItems?: string[];
}

interface FAQListProps {
  showTitle?: boolean;
  contentContainerStyle?: object;
}

export const FAQList: React.FC<FAQListProps> = ({
  showTitle = true,
  contentContainerStyle = { padding: 16 },
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("faq", settings.language);

  // Use memoized FAQ items to avoid unnecessary re-renders
  const FAQ_ITEMS = useMemo(() => {
    return [
      {
        question: t("developerQuestion"),
        answer: t("developerAnswer"),
      },
      {
        question: t("purposeQuestion"),
        answer: t("purposeAnswer"),
      },
      {
        question: t("dataProtectionQuestion"),
        answer: t("dataProtectionAnswer"),
        additionalAnswer: t("dataProtectionAdditional"),
      },
      {
        question: t("iceAccessQuestion"),
        answer: t("iceAccessAnswer"),
      },
      {
        question: t("accidentalPressQuestion"),
        answer: t("accidentalPressAnswer"),
      },
      {
        question: t("documentsQuestion"),
        answer: t("documentsAnswer"),
        listItems: [
          t("documentsListItem1"),
          t("documentsListItem2"),
          t("documentsListItem3"),
          t("documentsListItem4"),
          t("documentsListItem5"),
          t("documentsListItem6"),
        ],
      },
      {
        question: t("nilraQuestion"),
        answer: t("nilraAnswer"),
      },
      {
        question: t("nilraHelpQuestion"),
        answer: t("nilraHelpAnswer"),
        additionalAnswer: t("nilraHelpAdditional"),
      },
    ];
  }, [settings.language]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={true}
      contentContainerStyle={contentContainerStyle}
      className="px-4"
    >
      {showTitle && (
        <Text className="mb-6 text-center text-3xl font-bold text-black">
          {t("title")}
        </Text>
      )}

      {FAQ_ITEMS.map((item, index) => (
        <View key={index} className="mb-6">
          <Text className="mb-2 text-xl font-bold text-black">
            {item.question}
          </Text>
          <Text className="text-base text-gray-700">{item.answer}</Text>
          {item.additionalAnswer && (
            <Text className="text-base text-gray-700">
              {item.additionalAnswer}
            </Text>
          )}
          {item.listItems && (
            <View className="mt-2">
              {item.listItems.map((item, index) => (
                <Text key={index} className="text-base text-gray-700">
                  {item}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

// Add default export while maintaining the named export for compatibility
export default FAQList;
