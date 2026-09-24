import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from "firebase/auth";
import { useTranslation } from "react-i18next";

import { firebaseAuth } from "@/firebase/client";
import { config } from "@/constants/config";
import { useTheme } from "@/theme";

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

// Native module isn't available in Expo Go, so only load it elsewhere
// (dev builds / production builds).
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const Google: GoogleModule | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@react-native-google-signin/google-signin");

Google?.GoogleSignin.configure({
  webClientId: config.google.webClientId, // audience for the ID token Firebase verifies
  offlineAccess: false,
});

type Props = {
  onSignedIn: (result: UserCredential) => Promise<void> | void;
  onError: (err: unknown) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onSignedIn, onError, disabled }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  // Hide the button in Expo Go (hooks above must run before this return)
  if (!Google) return null;

  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = Google;
  const isDisabled = disabled || loading;

  const handlePress = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) throw new Error("No ID token returned from Google sign-in.");

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(firebaseAuth, credential);
      await onSignedIn(result);
    } catch (err) {
      // User cancellation isn't an error condition, so ignore it silently.
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return;
      console.log("Google Sign-In error:", JSON.stringify(err, null, 2));
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-3 dark:border-slate-700 dark:bg-slate-900 active:bg-slate-50 dark:active:bg-slate-800 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
            {t("auth.login.continueWithGoogle")}
          </Text>
        </>
      )}
    </Pressable>
  );
}