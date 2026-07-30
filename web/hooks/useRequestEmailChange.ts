import { useMutation } from "@tanstack/react-query";
import { verifyBeforeUpdateEmail, fetchSignInMethodsForEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

export function useRequestEmailChange() {
  return useMutation({
    mutationFn: async (newEmail: string) => {
      if (!firebaseAuth.currentUser) throw new Error("Not signed in.");

      // verifyBeforeUpdateEmail stays silent (no error, no email sent) if
      // newEmail already belongs to another account -- deliberately, to
      // avoid leaking which emails have accounts. Checking first here is
      // safe specifically because this only runs for an already-authenticated
      // user checking on their own behalf, not a public-facing probe.
      const methods = await fetchSignInMethodsForEmail(firebaseAuth, newEmail);
      if (methods.length > 0) {
        throw new Error("That email is already in use by another account.");
      }

      await verifyBeforeUpdateEmail(firebaseAuth.currentUser, newEmail);
    },
  });
}