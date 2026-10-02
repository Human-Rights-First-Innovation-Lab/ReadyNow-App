import React, { createContext, useContext, useState, ReactNode } from "react";
import { Linking } from "react-native";
import { CustomModal } from "../components/CustomModal";
import { usePageTranslation } from "../translations";
import { useAppSettings } from "../utils/app-settings";

type ModalButton = {
  text: string;
  onPress: () => void;
  type: "primary" | "secondary" | "danger";
};

type ModalContextType = {
  showModal: (params: {
    title: string;
    message: string;
    buttons: ModalButton[];
  }) => void;
  hideModal: () => void;
  showAlert: (title: string, message: string, onOk?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  showSuccess: (message: string, onOk?: () => void) => void;
  showError: (message: string, onOk?: () => void) => void;
  // Alert-specific modals
  showCountdownModal: (countdown: number, onCancel: () => void) => void;
  hideCountdownModal: () => void;
  showAlertSentModal: (onAccidental: () => void, onClose: () => void) => void;
  hideAlertSentModal: () => void;
  showAccidentalModal: (onClose: () => void) => void;
  hideAccidentalModal: () => void;
  showRateLimitModal: (message: string, onClose: () => void) => void;
  hideRateLimitModal: () => void;
  // Generic message-and-close modal. Same implementation as the rate-limit
  // modal, which is no longer used for rate limits - alerts are deduplicated
  // rather than blocked - but is exactly the shape needed to tell a user their
  // alert could not be delivered.
  showNoticeModal: (message: string, onClose: () => void) => void;
  hideNoticeModal: () => void;
  showLoadingModal: (message: string) => void;
  hideLoadingModal: () => void;
  updateLoadingMessage: (message: string) => void;
  // State getters
  isAlertSentModalVisible: boolean;
  isLoadingModalVisible: boolean;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("alert-button", settings.language);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalButtons, setModalButtons] = useState<ModalButton[]>([]);

  // Alert-specific modal states
  const [countdownModalVisible, setCountdownModalVisible] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [countdownOnCancel, setCountdownOnCancel] = useState<
    (() => void) | null
  >(null);

  const [alertSentModalVisible, setAlertSentModalVisible] = useState(false);
  const [alertSentOnAccidental, setAlertSentOnAccidental] = useState<
    (() => void) | null
  >(null);
  const [alertSentOnClose, setAlertSentOnClose] = useState<(() => void) | null>(
    null
  );

  const [accidentalModalVisible, setAccidentalModalVisible] = useState(false);
  const [accidentalOnClose, setAccidentalOnClose] = useState<
    (() => void) | null
  >(null);

  const [rateLimitModalVisible, setRateLimitModalVisible] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState("");
  const [rateLimitOnClose, setRateLimitOnClose] = useState<(() => void) | null>(
    null
  );

  const [loadingModalVisible, setLoadingModalVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  const showModal = ({
    title,
    message,
    buttons,
  }: {
    title: string;
    message: string;
    buttons: ModalButton[];
  }) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
  };

  // Helper for simple alert with OK button
  const showAlert = (title: string, message: string, onOk?: () => void) => {
    showModal({
      title,
      message,
      buttons: [
        {
          text: "OK",
          onPress: () => {
            hideModal();
            if (onOk) onOk();
          },
          type: "primary",
        },
      ],
    });
  };

  // Helper for confirmation dialogs with Yes/No or similar buttons
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText: string = "Yes",
    cancelText: string = "Cancel"
  ) => {
    showModal({
      title,
      message,
      buttons: [
        {
          text: cancelText,
          onPress: () => {
            hideModal();
            if (onCancel) onCancel();
          },
          type: "secondary",
        },
        {
          text: confirmText,
          onPress: () => {
            hideModal();
            onConfirm();
          },
          type: "danger",
        },
      ],
    });
  };

  // Helper for success messages
  const showSuccess = (message: string, onOk?: () => void) => {
    showAlert("Success", message, onOk);
  };

  // Helper for error messages
  const showError = (message: string, onOk?: () => void) => {
    showAlert("Error", message, onOk);
  };

  // Alert-specific modal functions
  const showCountdownModal = (countdown: number, onCancel: () => void) => {
    setCountdownValue(countdown);
    setCountdownOnCancel(() => onCancel);
    setCountdownModalVisible(true);
  };

  const hideCountdownModal = () => {
    setCountdownModalVisible(false);
  };

  const showAlertSentModal = (
    onAccidental: () => void,
    onClose: () => void
  ) => {
    setAlertSentOnAccidental(() => onAccidental);
    setAlertSentOnClose(() => onClose);
    setAlertSentModalVisible(true);
  };

  const hideAlertSentModal = () => {
    setAlertSentModalVisible(false);
  };

  const showAccidentalModal = (onClose: () => void) => {
    setAccidentalOnClose(() => onClose);
    setAccidentalModalVisible(true);
  };

  const hideAccidentalModal = () => {
    setAccidentalModalVisible(false);
  };

  const showRateLimitModal = (message: string, onClose: () => void) => {
    // Hide any other modals first to prevent stacking
    setLoadingModalVisible(false);
    setCountdownModalVisible(false);
    setAlertSentModalVisible(false);
    setAccidentalModalVisible(false);
    setModalVisible(false);
    
    setRateLimitMessage(message);
    setRateLimitOnClose(() => onClose);
    setRateLimitModalVisible(true);
  };

  const hideRateLimitModal = () => {
    setRateLimitModalVisible(false);
  };

  const showLoadingModal = (message: string) => {
    // Hide any other modals first to prevent stacking
    setModalVisible(false);
    setCountdownModalVisible(false);
    setAlertSentModalVisible(false);
    setAccidentalModalVisible(false);
    setRateLimitModalVisible(false);
    
    setLoadingMessage(message);
    setLoadingModalVisible(true);
  };

  const hideLoadingModal = () => {
    setLoadingModalVisible(false);
  };

  const updateLoadingMessage = (message: string) => {
    setLoadingMessage(message);
  };

  return (
    <ModalContext.Provider
      value={{
        showModal,
        hideModal,
        showAlert,
        showConfirm,
        showSuccess,
        showError,
        showCountdownModal,
        hideCountdownModal,
        showAlertSentModal,
        hideAlertSentModal,
        showAccidentalModal,
        hideAccidentalModal,
        showRateLimitModal,
        hideRateLimitModal,
        showNoticeModal: showRateLimitModal,
        hideNoticeModal: hideRateLimitModal,
        showLoadingModal,
        hideLoadingModal,
        updateLoadingMessage,
        isAlertSentModalVisible: alertSentModalVisible,
        isLoadingModalVisible: loadingModalVisible,
      }}
    >
      {children}
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onClose={hideModal}
        buttons={modalButtons}
      />

      {/* Countdown Modal */}
      <CustomModal
        visible={countdownModalVisible}
        title={t("sendingAlert")}
        message={t("emergencyMessagesSent").replace(
          "{seconds}",
          String(countdownValue)
        )}
        onClose={() => {}}
        buttons={[
          {
            text: t("cancelAlert"),
            onPress: () => {
              hideCountdownModal();
              if (countdownOnCancel) countdownOnCancel();
            },
            type: "danger",
          },
        ]}
      />

      {/* Alert Sent Modal */}
      <CustomModal
        visible={alertSentModalVisible}
        title={t("alertSent")}
        message={t("alertSentMessage")}
        onClose={() => {}}
        buttons={[
          {
            text: t("pressedByAccident"),
            onPress: () => {
              hideAlertSentModal();
              if (alertSentOnAccidental) alertSentOnAccidental();
            },
            type: "secondary",
          },
          {
            text: t("close"),
            onPress: () => {
              hideAlertSentModal();
              if (alertSentOnClose) alertSentOnClose();
            },
            type: "secondary",
          },
        ]}
      />

      {/* Accidental Press Modal */}
      <CustomModal
        visible={accidentalModalVisible}
        title={t("accidentalButtonPress")}
        message={t("accidentalMessage")}
        onClose={() => {}}
        buttons={[
          {
            text: t("emailNilra"),
            onPress: () => {
              const subject = encodeURIComponent("ReadyNow! Accidental Alert Notification");
              const body = encodeURIComponent(
                "This alert was triggered accidentally. Please disregard.\n\n" +
                "Name: [First & Last Name(s)]\n\n" +
                "Do not include any additional personal information."
              );
              const mailtoUrl = `mailto:datahelp@nilra.org?subject=${subject}&body=${body}`;
              
              Linking.openURL(mailtoUrl).catch((err) => {
                console.error("Failed to open email client:", err);
              });
            },
            type: "primary",
          },
          {
            text: t("close"),
            onPress: () => {
              hideAccidentalModal();
              if (accidentalOnClose) accidentalOnClose();
            },
            type: "secondary",
          },
        ]}
      />

      {/* Rate Limit Modal */}
      <CustomModal
        visible={rateLimitModalVisible}
        title={t("dailyLimitReached")}
        message={rateLimitMessage}
        onClose={() => {}}
        buttons={[
          {
            text: t("understand"),
            onPress: () => {
              hideRateLimitModal();
              if (rateLimitOnClose) rateLimitOnClose();
            },
            type: "primary",
          },
        ]}
      />

      {/* Loading Modal */}
      <CustomModal
        visible={loadingModalVisible}
        title={t("processingAlert")}
        message={loadingMessage}
        onClose={() => {}}
        buttons={[]}
        animationType="fade"
      />
    </ModalContext.Provider>
  );
};

// Add default export
export default ModalProvider;
