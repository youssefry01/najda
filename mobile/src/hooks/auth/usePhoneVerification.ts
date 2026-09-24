import { createElement, useCallback, useRef, useState } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { linkWithCredential, updatePhoneNumber, PhoneAuthProvider } from "firebase/auth";
import { firebaseAuth } from "@/firebase/client";
import { config } from "@/constants/config";
import { getRecaptchaHtml } from "./recaptchaHtml";

type Stage = "idle" | "code-sent";

/**
 * Real-number-capable phone verification via an invisible WebView running
 * Firebase's actual RecaptchaVerifier (see recaptchaHtml.ts for why the
 * previous dummy-verifier approach could never work: the test-number
 * bypass is implemented inside that class's own render/verify logic, not
 * as a check the SDK applies to any object shaped like ApplicationVerifier).
 *
 * The WebView only solves the captcha and returns a verificationId; the
 * actual credential is built and applied against this app's real,
 * signed-in `firebaseAuth` instance below -- the WebView's Auth instance
 * never signs in and is discarded after each attempt.
 *
 * Uses createElement instead of JSX since this file is .ts, not .tsx.
 *
 * Render `RecaptchaBridge` (returned below) once, anywhere in the
 * consuming component's tree -- it has zero visual footprint.
 */
export function usePhoneVerification() {
  const [stage, setStage] = useState<Stage>("idle");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verificationId = useRef<string | null>(null);
  const webviewRef = useRef<WebView>(null);
  const pending = useRef<{ resolve: (id: string) => void; reject: (err: Error) => void } | null>(null);
  // Lazy useState initializer runs once, on first render -- config is
  // guaranteed resolved by then, same reasoning as before.
  const [html] = useState(() => getRecaptchaHtml());

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "verificationId" && pending.current) {
        pending.current.resolve(msg.verificationId);
        pending.current = null;
      } else if (msg.type === "error" && pending.current) {
        pending.current.reject(new Error(msg.message));
        pending.current = null;
      }
      // "ready" is informational only.
    } catch {
      // Ignore malformed messages from the page.
    }
  }, []);

  async function sendCode(phoneNumber: string) {
    setError(null);
    setSending(true);
    try {
      const id = await new Promise<string>((resolve, reject) => {
        pending.current = { resolve, reject };
        webviewRef.current?.postMessage(JSON.stringify({ type: "sendCode", phoneNumber }));
      });
      verificationId.current = id;
      setStage("code-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function confirmCode(code: string): Promise<boolean> {
    setError(null);
    setConfirming(true);
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      if (!verificationId.current) throw new Error("No verification in progress");

      const credential = PhoneAuthProvider.credential(verificationId.current, code);
      if (currentUser.phoneNumber) {
        await updatePhoneNumber(currentUser, credential);
      } else {
        await linkWithCredential(currentUser, credential);
      }

      await currentUser.getIdToken(true);
      reset();
      return true;
    } catch {
      setError("codeError");
      return false;
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStage("idle");
    verificationId.current = null;
    setError(null);
  }

  const RecaptchaBridge = createElement(WebView, {
    ref: webviewRef,
    // baseUrl gives the inline HTML a real origin to send requests from.
    // Without it, requests from a raw source.html WebView carry no/empty
    // Referer -- if your Firebase Web API key has HTTP referrer
    // restrictions configured in Google Cloud Console (common default),
    // Google rejects it as invalid from that context even though the key
    // itself is correct. authDomain is auto-authorized by default for
    // every Firebase Web API key, so this needs no extra Console setup.
    source: { html, baseUrl: `https://${config.firebase.authDomain}` },
    onMessage: handleMessage,
    style: { width: 0, height: 0, opacity: 0 },
    javaScriptEnabled: true,
    originWhitelist: ["*"],
  });

  return { stage, sendCode, confirmCode, reset, sending, confirming, error, RecaptchaBridge };
}