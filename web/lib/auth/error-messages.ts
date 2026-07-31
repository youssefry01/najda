export function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact an administrator.";
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "";

    // Phone verification — the missing set
    case "auth/invalid-phone-number":
      return "That phone number doesn't look valid. Include the country code, e.g. +20...";
    case "auth/missing-phone-number":
      return "Enter a phone number first.";
    case "auth/invalid-verification-code":
      return "That code is incorrect.";
    case "auth/missing-verification-code":
      return "Enter the code you were sent.";
    case "auth/code-expired":
      return "That code expired — send a new one.";
    case "auth/credential-already-in-use":
      return "This phone number is already linked to a different account.";
    case "auth/provider-already-linked":
      return "This account already has a verified phone number.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA check failed. Refresh the page and try again.";
    case "auth/invalid-app-credential":
      return "reCAPTCHA verification failed for this app/domain.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for this project right now.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";

    default:
      // Deliberately logged rather than silently swallowed -- this is
      // exactly how "Something went wrong" for phone errors went
      // unnoticed: an unmapped code and no visibility into what it was.
      console.warn(`Unmapped Firebase auth error code: ${code}`);
      return "Something went wrong. Please try again.";
  }
}