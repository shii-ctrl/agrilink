import { z } from "zod";

import { minimumPasswordLength } from "@/features/auth/password-requirements";

// This is a small local deny-list for the passwords attackers try first. The
// main defence remains long, unique passwords; no password is sent to a third
// party for checking.
const commonlyGuessedPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "123456789012",
  "password",
  "password123",
  "password1234",
  "qwerty123",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin123",
  "iloveyou123",
  "agrilink123",
]);

export const securePassword = z
  .string()
  .min(minimumPasswordLength, "Use at least 8 characters.")
  .max(200)
  .refine((value) => value.trim() === value, "Password cannot start or end with a space.")
  .refine(
    (value) => !commonlyGuessedPasswords.has(value.toLowerCase()),
    "Choose a password that is not commonly guessed.",
  );
