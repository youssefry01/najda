import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { getAdditionalUserInfo, sendSignInLinkToEmail, type UserCredential } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseAuth } from "@/firebase/client";
import { apiFetch } from "@/api/client";
import { config } from "@/constants/config";
import { EMAIL_FOR_SIGNIN_KEY } from "@/lib/auth/emailLinkStorage";
import { resolveAuthErrorKey, resolveRawErrorMessage } from "@/lib/auth/errors";
import { registerCitizenBootstrap } from "@/lib/auth/registerCitizenBootstrap";
import { useEmailAvailability } from "@/hooks/auth/useEmailAvailability";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Screen } from "@/components/ui/Screen";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useTheme } from "@/theme";
import { useDirection } from "@/lib/locale/useDirection";
import { Directional } from "@/components/ui/Directional";
import useAuth from "@/hooks/auth/useAuth";

function splitDisplayName(displayName: string | null): { firstName: string; lastName: string } {
  if (!displayName) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = displayName.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

export function RegisterScreen() {
  const { t } = useTranslation();
  const dir = useDirection();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailAvailability = useEmailAvailability(email);

  const { refetchProfile } = useAuth();

  async function handleSendLink() {
    setError(null);
    if (!agreed) {
      setError(t("auth.register.agreeRequired"));
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { exists } = await queryClient.fetchQuery({
        queryKey: ["email-exists", trimmedEmail],
        queryFn: () => apiFetch<{ exists: boolean }>(`/api/auth/email-exists?email=${encodeURIComponent(trimmedEmail)}`),
        staleTime: 60_000,
      });
      if (exists) {
        setError(t("auth.register.emailTaken"));
        return;
      }

      await sendSignInLinkToEmail(firebaseAuth, trimmedEmail, {
        url: `${config.webAppUrl}/complete-signup`,
        handleCodeInApp: true,
      });
      // Written so CompleteSignupScreen can complete sign-in without
      // asking again -- read if the Universal Link opens this app
      // directly instead of a browser (see app.json + README).
      await AsyncStorage.setItem(EMAIL_FOR_SIGNIN_KEY, trimmedEmail);
      router.push({ pathname: "/check-email", params: { email: trimmedEmail } });
    } catch (err) {
      setError(resolveRawErrorMessage(err) ?? t(resolveAuthErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignedIn(result: UserCredential) {
    const isNewUser = getAdditionalUserInfo(result)?.isNewUser;

    if (!agreed) {
      // Only delete if this credential minted a brand-new Firebase user.
      // If it signed into an existing one, deleting destroys a real account.
      if (isNewUser) {
        await result.user.delete().catch(() => null);
      } else {
        await firebaseAuth.signOut().catch(() => null);
      }
      setError(t("auth.register.agreeRequired"));
      return;
    }

    if (!isNewUser) {
      // Existing account signed into correctly -- treat as a login, not a
      // registration. useMe()/AuthListener already has the profile fetch
      // in flight; this just makes the transition feel immediate.
      await refetchProfile();
      return;
    }

    let registered = false;
    try {
      const { firstName, lastName } = splitDisplayName(result.user.displayName);
      await registerCitizenBootstrap({
        firstName,
        lastName,
        email: result.user.email ?? "",
        provider: "google",
      });
      registered = true;
      await refetchProfile();
    } catch (err) {
      // Safe here: isNewUser is true, so this Firebase user was minted by
      // *this* call. Rolling it back on a genuine registration failure
      // (network blip, backend 500, etc.) is the correct behavior.
      if (!registered) await result.user.delete().catch(() => null);
      setError(resolveRawErrorMessage(err) ?? t(resolveAuthErrorKey(err)));
    }
  }

  return (
    <Screen scroll className="justify-center">
      <View className="mb-2 mt-2 flex-row justify-end gap-2">
        <LanguageSwitcher compact />
        <ThemeSwitcher compact />
      </View>
      <View className="mb-8 items-center">
        <Image
          source={require("../../assets/images/logo-stacked.png")}
          className="h-16 w-16"
          resizeMode="contain"
        />
        <Text className="mt-3 text-center text-[15px] text-slate-500 dark:text-slate-400">
          {t("auth.register.subtitle")}
        </Text>
      </View>

      <Directional dir={dir}>
      <View className="gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <GoogleSignInButton disabled={!agreed} onSignedIn={handleGoogleSignedIn} onError={(err) => setError(t(resolveAuthErrorKey(err)))} />

        <View className="my-1 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <Text className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t("auth.register.or")}
          </Text>
          <View className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </View>

        <TextField
          label={t("auth.register.emailLabel")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={emailAvailability === "taken" ? t("auth.register.emailTaken") : null}
        />
        {emailAvailability === "checking" ? (
          <Text className="text-xs text-slate-400 dark:text-slate-500">{t("auth.register.emailChecking")}</Text>
        ) : emailAvailability === "available" ? (
          <Text className="text-xs text-emerald-600 dark:text-emerald-400">{t("auth.register.emailAvailable")}</Text>
        ) : null}

        <Pressable onPress={() => setAgreed((v) => !v)} className="flex-row items-start gap-2">
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-[1.5px] ${
              agreed ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-transparent dark:border-slate-700"
            }`}
          >
            {agreed ? <Ionicons name="checkmark" size={14} color={colors.textInverted} /> : null}
          </View>
          <Text className="flex-1 text-[13px] text-slate-500 dark:text-slate-400">
            {t("auth.register.agreeToTerms")}
          </Text>
        </Pressable>

        {error ? <Text className="text-[13px] text-red-600 dark:text-red-400">{error}</Text> : null}

        <Button
          label={loading ? t("auth.register.sendingLink") : t("auth.register.continueWithEmail")}
          onPress={handleSendLink}
          loading={loading}
          disabled={!email || !agreed || emailAvailability === "taken"}
          className="mt-1"
        />
      </View>

      <View className="mt-6 flex-row justify-center gap-1.5">
        <Text className="text-slate-500 dark:text-slate-400">{t("auth.register.alreadyHaveAccount")}</Text>
        <Link href="/login">
          <Text className="font-semibold text-blue-600">{t("auth.register.signIn")}</Text>
        </Link>
      </View>
      </Directional>
    </Screen>
  );
}
