import { config } from "@/constants/config";

/**
 * Loaded inside an invisible WebView (see usePhoneVerification.ts). Runs a
 * REAL firebase.auth.RecaptchaVerifier -- the only supported way to get a
 * genuine reCAPTCHA solve for phone auth on a platform without a DOM. This
 * is a separate, short-lived Auth instance purely for solving the captcha;
 * it never signs in, and the resulting verificationId is handed back to
 * the app's real signed-in Auth instance to actually apply the credential.
 *
 * setting so test numbers work here the same way they do everywhere else --
 * this only affects numbers explicitly whitelisted in the Firebase Console,
 * real numbers still require a real solve regardless of this flag.
 *
 * This is a function, not a module-level constant -- config values are
 * read at call time (when the hook renders), not at import time.
 */
export function getRecaptchaHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;">
<div id="recaptcha-container"></div>
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js"></script>
<script>
  var firebaseConfig = ${JSON.stringify({
    apiKey: config.firebase.apiKey,
    authDomain: config.firebase.authDomain,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
    messagingSenderId: config.firebase.messagingSenderId,
    appId: config.firebase.appId,
  })};
  
  // forward errors and logs to React Native
  window.onerror = function (m) { post({ type: "log", message: "onerror: " + m }); };
  console.log = function () { post({ type: "log", message: [].slice.call(arguments).join(" ") }); };
  post({ type: "log", message: "apiKey present: " + !!firebaseConfig.apiKey });

  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  auth.settings.appVerificationDisabledForTesting = true; // dev only

  var verifier = null;

  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  async function sendCode(phoneNumber) {
    try {
      // A widget is single-use -- always drop and re-render fresh,
      // otherwise resend attempts fail against an already-spent verifier.
      if (verifier) {
        verifier.clear();
        verifier = null;
      }
      // Auth FIRST, then container, then parameters -- (container,
      // parameters, app) was the legacy v8 compat order and no longer
      // matches the current SDK, which expects
      // (auth, containerOrId, parameters). Passing them in the old order
      // put the container id string where an Auth object was expected,
      // which is what produced the invalid-api-key error.
      verifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
        size: "invisible",
      });
      var provider = new firebase.auth.PhoneAuthProvider(auth);
      var verificationId = await provider.verifyPhoneNumber(phoneNumber, verifier);
      post({ type: "verificationId", verificationId: verificationId });
    } catch (err) {
      post({ type: "error", message: err && err.message ? err.message : String(err) });
    }
  }

  function handleRNMessage(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === "sendCode") sendCode(msg.phoneNumber);
    } catch (err) {
      post({ type: "error", message: "Bad message from app: " + String(err) });
    }
  }

  // Android delivers postMessage via 'message' on document; iOS via window.
  document.addEventListener("message", function (e) { handleRNMessage(e.data); });
  window.addEventListener("message", function (e) { handleRNMessage(e.data); });

  post({ type: "ready" });
</script>
</body>
</html>`;
}