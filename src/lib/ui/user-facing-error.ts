const privateErrorPatterns = [
  /failed query/i,
  /\bparams?:\s/i,
  /\bsqlstate\b/i,
  /\ber_(?:dup|no|bad|parse|lock|data|access|table|column|row|truncated)[a-z_]*/i,
  /\b(?:select|insert\s+into|delete\s+from|alter\s+table|create\s+table)\s+[`"']/i,
  /\bupdate\s+[`"'][^`"']+[`"']\s+set\b/i,
  /\b(?:mysql|mariadb|drizzle|planetscale|database)\b.*\b(?:query|connection|host|table)\b/i,
  /\bat\s+[\w.$<>]+\s+\([^\n]+:\d+:\d+\)/,
];

export const genericActionError =
  "Please try again. If the problem continues, contact PROCY support.";

/** Keeps database details, parameters, and stack traces out of user-facing UI. */
export function userFacingErrorMessage(value: unknown, fallback = genericActionError) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  const normalized = message.trim();
  if (!normalized || privateErrorPatterns.some((pattern) => pattern.test(normalized))) {
    return fallback;
  }
  return normalized;
}
