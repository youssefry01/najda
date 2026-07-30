import { mapFirebaseAuthError } from "./error-messages";

export function resolveAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;

  if (code) {
    return mapFirebaseAuthError(code);
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Something went wrong. Please try again.";
}