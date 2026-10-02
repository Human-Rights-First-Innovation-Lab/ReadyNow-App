import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import {
  loadEmergencyPlanData,
} from "../utils/storage-utils";
import Button from "./Button";
import { decryptData } from "../utils/encryption-utils";
import { transformToOldFormat } from "../utils/emergency-plan-utils";
import type { EmergencyPlanData } from "../utils/emergency-plan-utils";
import { STORAGE_KEYS } from "../utils/auth-service";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
import { sendIntakeToNilra } from "../services/nilra-api";
import {
  cancelAlert,
  fireAlert,
  prepareAlert,
  stageAlert,
} from "../services/alert-api";
import type {
  AlertGroup,
  AlertLocation,
  FireOutcome,
  PreparedAlert,
} from "../services/alert-api";
import { ensureDeviceCredential } from "../utils/device-credential";
import { endSession, wipeDeviceData } from "../utils/fresh-install-reset";
import { useAuth } from "../utils/use-auth";
import { useModal } from "../context/ModalContext";
import * as Sentry from "@sentry/react-native";

interface AlertButtonProps {
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  isDemoMode?: boolean;
}

const DEBUG_MODAL = true;

// How long the outcome modal waits for a response before signing the user out
// on their behalf. Long enough to read the modal and tap; short enough that a
// phone set down - or taken - does not stay signed in.
const SIGN_OUT_GRACE_MS = 5000;

const AlertButton: React.FC<AlertButtonProps> = ({
  onPress,
  size = 200,
  disabled = false,
  isDemoMode = false,
}) => {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { checkAuthStatus } = useAuth();
  const { t } = usePageTranslation("alert-button", settings.language);
  const modal = useModal();

  const [pressing, setPressing] = useState(false);
  const [showCountdownModal, setShowCountdownModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const signOutTimer = useRef<NodeJS.Timeout | null>(null);

  // Payload prepared and uploaded during the countdown, so the commit call is
  // small. Holds a promise because staging runs concurrently with the 3s the
  // user spends watching the countdown.
  const preparedAlertRef = useRef<Promise<PreparedAlert | null> | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const colorAnimation = useRef(new Animated.Value(0)).current;

  // Animation for the press progress
  useEffect(() => {
    if (pressing) {
      Animated.parallel([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(colorAnimation, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      animatedValue.setValue(0);
      colorAnimation.setValue(0);
    }
  }, [pressing, animatedValue, colorAnimation]);

  // Handle button press start
  // Heal a credential that never registered at sign-up, long before anyone
  // needs it. Without one, every alert would fail at the worst possible moment.
  useEffect(() => {
    if (isDemoMode) return;
    void ensureDeviceCredential();
  }, [isDemoMode]);

  const handlePressIn = () => {
    if (disabled) return;

    setPressing(true);

    // Start timer for 3 seconds
    pressTimer.current = setTimeout(() => {
      setPressing(false);
      setShowCountdownModal(true);
      // The press is committed; start uploading now so the countdown is spent
      // on the network rather than after it.
      if (!isDemoMode) beginStaging();
      startCountdown();
    }, 1500) as unknown as NodeJS.Timeout;
  };

  // Handle button press end
  const handlePressOut = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setPressing(false);
  };

  // Start the 5-second countdown
  const startCountdown = () => {
    setCountdown(3);

    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
          }
          setShowCountdownModal(false);
          void handleAlertSent();
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as NodeJS.Timeout;
  };

  // Handle alert cancellation
  const handleCancelAlert = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }

    // Discard the staged payload. Best effort: it is unreadable without the
    // key and expires on its own, so a failure here costs nothing.
    const pending = preparedAlertRef.current;
    preparedAlertRef.current = null;
    if (pending) {
      void pending
        .then((prepared) => (prepared ? cancelAlert(prepared) : undefined))
        .catch(() => undefined);
    }

    setShowCountdownModal(false);
    setShowCancelledModal(true);
  };

  /**
   * Clear everything the device holds about the plan.
   *
   * Runs on the outcome of an alert, success or failure alike. The user is
   * assumed to be facing detention and seizure, so disclosure is the worse
   * risk - a failed send does not earn a reprieve.
   */
  const wipeLocalData = async () => {
    try {
      // Data only. The session is ended separately, once the user has had a
      // moment to read the outcome - see leaveAsFreshInstall.
      await wipeDeviceData();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "AlertButton", action: "wipe_local_data" },
        level: "fatal",
      });
    }
  };

  /**
   * Encrypt the plan and upload it while the countdown runs.
   *
   * The user has already pressed and held by this point, so nothing leaves the
   * device before they act. The upload is ciphertext only - it stays
   * unreadable unless the countdown completes and the key is handed over.
   */
  const beginStaging = () => {
    preparedAlertRef.current = (async () => {
      try {
      const plan = await loadEmergencyPlanData();

      const groups: AlertGroup[] = (plan.messages || [])
        .map((message) => {
          const normalizedTopic =
            message.topic.includes("법적지원") ||
            message.topic.includes("Apoyo Legal") ||
            message.topic.toLowerCase().includes("legal")
              ? "Legal Support"
              : message.topic;

          const validContacts = (message.contacts || []).filter(
            (contact) => contact.phoneNumber && contact.phoneNumber.trim() !== ""
          );

          return {
            body: message.message,
            to: validContacts.map((contact) => contact.phoneNumber),
            names:
              normalizedTopic === "Other" || message.topic === "Other"
                ? []
                : validContacts
                    .map((contact) => contact.name)
                    .filter((name) => name && name.trim() !== ""),
          };
        })
        .filter((group) => group.body && group.to.length > 0);

        const prepared = await prepareAlert(groups);
        await stageAlert(prepared);
        return prepared;
      } catch (error) {
        // Staging is best effort. Resolving null rather than rejecting matters:
        // a rejected promise awaited on the fire path would throw past the
        // wipe, leaving plan data on a device that is about to be seized.
        Sentry.captureException(error, {
          tags: { component: "AlertButton", action: "stage_alert" },
          level: "warning",
        });
        return null;
      }
    })();
  };

  // Handle alert sent
  const handleAlertSent = async () => {
    // If in demo mode, just call onPress to trigger demo complete modal
    if (isDemoMode) {
      onPress();
      return;
    }

    try {
      // Show loading modal - use setTimeout to avoid render phase update
      setTimeout(() => {
        modal.showLoadingModal("Sending alert...");
      }, 0);

      // Add small delay to ensure modal renders
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if location sharing is enabled
      const legalSupportDataStr = await SecureStore.getItemAsync(
        "additionalLegalHelp"
      );

      let locationRetrievalPromise = null;

      // Get user information with userId
      let userId = null;
      try {
        const userInfoStr = await SecureStore.getItemAsync(
          STORAGE_KEYS.USER_INFO
        );
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          userId = userInfo.userId;
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: "AlertButton", action: "load_user_info" },
          level: "warning",
        });
      }

      if (legalSupportDataStr) {
        const legalSupportData = JSON.parse(legalSupportDataStr);

        // If location sharing is enabled, get current location
        if (legalSupportData.enableLocationSharing) {
          try {
            // Get more detailed permission status first for iOS
            let { status } = await Location.getForegroundPermissionsAsync();

            // On iOS, double-check permissions and request again if not determined
            if (
              Platform.OS === "ios" &&
              status !== Location.PermissionStatus.GRANTED
            ) {
              const permResult =
                await Location.requestForegroundPermissionsAsync();
              status = permResult.status;
            }

            // Additional iOS diagnostics
            if (Platform.OS === "ios") {
              try {
                const hasServicesEnabled =
                  await Location.hasServicesEnabledAsync();

                // Check background permissions too even though we're using foreground
                const bgPermission =
                  await Location.getBackgroundPermissionsAsync();
              } catch (error) {
                // iOS diagnostics error handling
              }
            }

            if (status === Location.PermissionStatus.GRANTED) {
              // On iOS, try to pre-warm the location provider
              let quickLocationData = null;
              if (Platform.OS === "ios") {
                try {
                  // Get a low-accuracy location first with a shorter timeout
                  const quickLocationPromise = Location.getCurrentPositionAsync(
                    {
                      accuracy: Location.Accuracy.Balanced,
                    }
                  );

                  // Use a shorter timeout for the quick location (3 seconds)
                  const quickTimeout = new Promise((_, reject) => {
                    setTimeout(
                      () => reject(new Error("Quick location timed out")),
                      3000
                    );
                  });

                  // Race the quick location request
                  const quickLocation = (await Promise.race([
                    quickLocationPromise,
                    quickTimeout,
                  ])) as Location.LocationObject;

                  // Save this quick location as a fallback
                  quickLocationData = quickLocation;

                  // Immediately save this as a temporary location in case high accuracy fails
                  const tempLegalSupportData = JSON.parse(
                    JSON.stringify(legalSupportData)
                  );
                  tempLegalSupportData.location = {
                    latitude: quickLocation.coords.latitude,
                    longitude: quickLocation.coords.longitude,
                    accuracy: quickLocation.coords.accuracy ?? undefined,
                    timestamp: quickLocation.timestamp,
                    quality: "low", // Mark quality for diagnostics
                  };

                  // Save the quick location immediately as a backup
                  await SecureStore.setItemAsync(
                    "additionalLegalHelp",
                    JSON.stringify(tempLegalSupportData)
                  );
                } catch (error) {
                  // iOS pre-warm error handling
                }
              }

              // Start location retrieval in the background with timeout
              locationRetrievalPromise = (async () => {
                try {
                  // Create a promise that will reject after 10 seconds
                  const locationTimeout = new Promise((_, reject) => {
                    setTimeout(
                      () => reject(new Error("Location retrieval timed out")),
                      10000
                    );
                  });

                  try {
                    // Race between actual location retrieval and timeout
                    const location = (await Promise.race([
                      Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Highest, // Increase accuracy for iOS
                        timeInterval: 1000, // Specify refresh time in ms for better results
                        mayShowUserSettingsDialog: true,
                      }),
                      locationTimeout,
                    ])) as Location.LocationObject;

                    // Update the legal support data with current location
                    legalSupportData.location = {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                      accuracy: location.coords.accuracy ?? undefined,
                      timestamp: location.timestamp,
                    };
                  } catch (locError) {
                    // If high accuracy location fails, but we have the quick location, use that
                    if (quickLocationData) {
                      legalSupportData.location = {
                        latitude: quickLocationData.coords.latitude,
                        longitude: quickLocationData.coords.longitude,
                        accuracy:
                          quickLocationData.coords.accuracy ?? undefined,
                        timestamp: quickLocationData.timestamp,
                        fallback: true, // Mark this as fallback data
                      };
                    } else {
                      throw locError; // Re-throw if we don't have fallback
                    }
                  }

                  // Save updated data with location
                  await SecureStore.setItemAsync(
                    "additionalLegalHelp",
                    JSON.stringify(legalSupportData)
                  );

                  // Verify the updated data was saved correctly
                  const updatedData = await SecureStore.getItemAsync(
                    "additionalLegalHelp"
                  );
                  const parsedUpdatedData = JSON.parse(updatedData || "{}");

                  if (parsedUpdatedData.location) {
                    return true;
                  } else {
                    return false;
                  }
                } catch (error) {
                  return false;
                }
              })();

              // Now we wait for location retrieval before continuing
              try {
                modal.updateLoadingMessage("Waiting for location data...");
                // Give iOS more time to get accurate location
                await Promise.race([
                  locationRetrievalPromise,
                  // Wait up to 8 seconds for location on iPhone - iOS sometimes needs more time
                  new Promise((resolve) =>
                    setTimeout(resolve, Platform.OS === "ios" ? 5000 : 5000)
                  ),
                ]);
              } catch (error) {
                Sentry.captureException(error, {
                  tags: { component: "AlertButton", action: "location_wait" },
                  level: "warning",
                });
              }
            }
          } catch (error) {
            Sentry.captureException(error, {
              tags: { component: "AlertButton", action: "location_permission" },
              level: "warning",
            });
          }
        }

        // Save legal support data to NILRA API
        try {
          // Update loading message
          modal.updateLoadingMessage("Saving legal support data...");

          // Get user phone number for reference
          const userPhoneNumber = await SecureStore.getItemAsync(
            "user_phone_number"
          );

          // Get the latest legal support data (includes location if available)
          const latestLegalSupportDataStr = await SecureStore.getItemAsync(
            "additionalLegalHelp"
          );
          const latestLegalSupportData = latestLegalSupportDataStr
            ? JSON.parse(latestLegalSupportDataStr)
            : legalSupportData;

          // Send to NILRA API
          const result = await sendIntakeToNilra(
            latestLegalSupportData,
            userId || undefined,
            userPhoneNumber || undefined,
            settings.language
          );

          if (!result.success) {
            // Log error but continue with alert process
            console.error("Failed to save to NILRA:", result.error);
            modal.hideLoadingModal();
          }
        } catch (error) {
          Sentry.captureException(error, {
            tags: { component: "AlertButton", action: "nilra_save" },
            level: "error",
          });
          modal.hideLoadingModal();
        }
      }

      // Declare messagesData outside try block so it's accessible later
      let messagesData: {
        messages: {
          id: string;
          topic: string;
          message: string;
          contacts: {
            id: string;
            name: string;
            phoneNumber: string;
          }[];
        }[];
      } = { messages: [] };

      // Load the emergency plan. This deliberately goes through the shared
      // loader rather than re-implementing format handling here: it knows every
      // storage format including the current AEAD one, and upgrades older
      // records on read. A private copy of this logic silently stopped
      // understanding the current format once the format version moved on.
      try {
        modal.updateLoadingMessage("Preparing messages...");
        messagesData = await loadEmergencyPlanData();
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: "AlertButton", action: "load_plan" },
          level: "error",
        });
      }

      // Build the wire payload. Distinct message bodies and recipients are sent
      // once and composed by the endpoint rather than expanded here: the staged
      // blob is what has to cross a bad network under duress, so its size is
      // the thing that decides whether an alert gets out at all.
      const groups: AlertGroup[] = (messagesData.messages || [])
        .map((message) => {
          const normalizedTopic =
            message.topic.includes("법적지원") ||
            message.topic.includes("Apoyo Legal") ||
            message.topic.toLowerCase().includes("legal")
              ? "Legal Support"
              : message.topic;

          const validContacts = (message.contacts || []).filter(
            (contact) => contact.phoneNumber && contact.phoneNumber.trim() !== ""
          );

          return {
            body: message.message,
            to: validContacts.map((contact) => contact.phoneNumber),
            // Recipient names are not echoed for the "Other" topic.
            names:
              normalizedTopic === "Other" || message.topic === "Other"
                ? []
                : validContacts
                    .map((contact) => contact.name)
                    .filter((name) => name && name.trim() !== ""),
          };
        })
        .filter((group) => group.body && group.to.length > 0);

      // Read whatever location was resolved while the user was pressing.
      let location: AlertLocation | null = null;
      try {
        const latest = await SecureStore.getItemAsync("additionalLegalHelp");
        const parsed = latest ? JSON.parse(latest) : null;
        if (parsed?.location?.latitude != null && parsed?.location?.longitude != null) {
          location = {
            lat: parsed.location.latitude,
            lng: parsed.location.longitude,
          };
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: "AlertButton", action: "read_location" },
          level: "warning",
        });
      }

      // Hand off. The payload was staged during the countdown, so this is
      // normally a few hundred bytes carrying the decryption key.
      let outcome: FireOutcome = { ok: false, reason: "unreachable" };

      if (groups.length > 0) {
        modal.updateLoadingMessage("Sending emergency messages...");

        try {
          const prepared =
            (await preparedAlertRef.current) ?? (await prepareAlert(groups));

          outcome = await fireAlert(prepared, location);
        } catch (error) {
          // Any failure here is a failed handoff, not an excuse to skip the
          // wipe or to leave the user without an answer.
          outcome = { ok: false, reason: "unreachable" };
          Sentry.captureException(error, {
            tags: { component: "AlertButton", action: "fire_alert" },
            level: "error",
          });
        }

        if (!outcome.ok) {
          Sentry.captureMessage("Emergency alert handoff failed", {
            tags: {
              component: "AlertButton",
              action: "fire_alert",
              reason: outcome.reason,
            },
            level: "error",
          });
        }
      } else {
        // Nothing to send. Treat as handed off so the user is not told an
        // alert failed when there was never one to make.
        outcome = { ok: true, created: 0, deduped: 0 };
      }

      preparedAlertRef.current = null;

      // Wipe now, on the outcome, rather than when a modal is dismissed. The
      // device is assumed to be about to be seized, so the data must not
      // survive until the user happens to tap Close - and it must go whether
      // or not delivery succeeded.
      await wipeLocalData();

      if (DEBUG_MODAL) {
        startSignOutTimer();
        setTimeout(() => {
          if (outcome.ok) {
            modal.showAlertSentModal(handleAccidentalPress, handleCloseAlertSent);
          } else {
            // Never claim an alert was sent when it was not. Someone who knows
            // their contacts were not reached can find another way; someone
            // shown a success screen cannot.
            modal.showNoticeModal(t("deliveryFailed"), handleCloseAlertSent);
          }
        }, 0);
      } else {
        // No modal to dismiss and no grace period to wait out: end the session
        // now rather than leave it open with nothing to close it.
        void leaveAsFreshInstall();
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "AlertButton", action: "handle_alert_sent" },
        level: "fatal",
      });
    } finally {
      setTimeout(() => {
        modal.hideLoadingModal();
      }, 0);
    }
  };

  const cancelSignOutTimer = () => {
    if (signOutTimer.current) {
      clearTimeout(signOutTimer.current);
      signOutTimer.current = null;
    }
  };

  /**
   * End the session and leave. Runs exactly once, whichever way the user gets
   * here - a dismissed modal, or the grace period expiring untouched.
   */
  const leaveAsFreshInstall = async () => {
    cancelSignOutTimer();
    try {
      await endSession();
      // Storage is now empty, but the auth context still holds the old session
      // in React state. Re-read it so the root gate routes to the welcome flow.
      await checkAuthStatus();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "AlertButton", action: "end_session" },
        level: "fatal",
      });
    }
    router.replace("/");
  };

  /**
   * Sign the user out if they never answer the outcome modal. A phone put down
   * - or taken - must not be left holding a live session.
   */
  const startSignOutTimer = () => {
    cancelSignOutTimer();
    signOutTimer.current = setTimeout(() => {
      void leaveAsFreshInstall();
    }, SIGN_OUT_GRACE_MS);
  };

  /**
   * "It was accidental" is not a reason to sign anyone out. It opens a notice
   * telling them who to email, which they need long enough to read and write
   * down, so the grace timer stops here and the session ends when they close
   * that notice instead.
   */
  const handleAccidentalPress = () => {
    cancelSignOutTimer();
    modal.hideAlertSentModal();
    modal.showAccidentalModal(handleCreateNewPlan);
  };

  // Handle creating new emergency plan.
  // Data was already wiped when the alert resolved, so this only navigates.
  const handleCreateNewPlan = () => {
    modal.hideAccidentalModal();
    void leaveAsFreshInstall();
  };

  // Close handler for both the sent and the delivery-failed modals.
  // The wipe already happened when the alert resolved - it is deliberately not
  // gated on the user tapping anything, because the phone may be taken first.
  const handleCloseAlertSent = () => {
    modal.hideAlertSentModal();
    modal.hideNoticeModal();
    void leaveAsFreshInstall();
  };

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
      if (signOutTimer.current) {
        clearTimeout(signOutTimer.current);
      }
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
    };
  }, []);

  return (
    <View className="items-center justify-center px-5 shadow-md shadow-gray-400">
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: disabled ? 0 : 8,
          shadowColor: "#000",
          shadowOffset: { width: 1, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          }}
        >
          <LinearGradient
            colors={isDemoMode ? ["#000000", "#34C759"] : ["#000000", "#e56049"]}
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </Animated.View>
        <TouchableOpacity
          className={`items-center justify-center overflow-hidden ${isDemoMode ? "bg-[#34C759]" : "bg-[#e56049]"}`}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Image
            source={require("../../assets/images/alert-button-logo.png")}
            style={{
              width: size * 0.3,
              height: size * 0.3,
              marginBottom: 10,
            }}
            resizeMode="contain"
          />
          <Text className="p-2.5 text-center text-2xl font-bold text-white">
            {t("sendAlert")}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Countdown Modal */}
      <Modal
        visible={showCountdownModal}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-5">
          <View className="w-full max-w-md items-center rounded-xl bg-white p-5">
            <Text className="mb-4 text-center text-2xl font-bold">
              {t("sendingAlert")}
            </Text>
            <Text className={`my-2.5 text-6xl font-bold ${isDemoMode ? "text-green-600" : "text-red-600"}`}>
              {countdown}
            </Text>
            <Text className="mb-2.5 text-center text-base text-gray-600">
              {isDemoMode 
                ? t("emergencyMessagesSentDemo")
                : t("emergencyMessagesSent").replace(
                    "{seconds}",
                    String(countdown)
                  )}
            </Text>

            <Button
              text={isDemoMode ? t("practiceCancelling") : t("cancelAlert")}
              onPress={handleCancelAlert}
              style={{ backgroundColor: isDemoMode ? "#34C759" : "#FF3B30", marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Cancelled Modal */}
      <Modal
        visible={showCancelledModal}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-5">
          <View className="w-full max-w-md items-center rounded-xl bg-white p-5">
            <Text className="mb-4 text-center text-2xl font-bold">
              {t("alertCancelled")}
            </Text>
            <Text className="mb-2.5 text-center text-base text-gray-600">
              {t("alertCancelledMessage")}
            </Text>

            <Button
              text={t("close")}
              onPress={() => setShowCancelledModal(false)}
              style={{ backgroundColor: "#8c8d98", marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Alert Sent, Accidental, Rate Limit, and Loading modals are now handled by ModalContext */}
    </View>
  );
};

export default AlertButton;
