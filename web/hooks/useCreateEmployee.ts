import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api/client";
import type { User, Gender } from "@/types/user";
import type { UserRole } from "@/lib/auth/roles";

const CREATE_EMPLOYEE_PATH = "/api/auth/register/employee";

export type CreateEmployeeRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  gender: Gender;
  roleName: UserRole;
};

// Guessed field name -- confirm EmployeeRegistrationResponse's actual
// second field (resetLink vs passwordResetLink vs something else).
export type CreateEmployeeResponse = {
  user: User;
  passwordResetLink: string;
};

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEmployeeRequest) =>
      apiFetch<CreateEmployeeResponse>(CREATE_EMPLOYEE_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      try {
        await sendPasswordResetEmail(firebaseAuth, variables.email);
      } catch (err) {
        console.error("Failed to send invite email via Firebase:", err);
      }
    },
  });
}