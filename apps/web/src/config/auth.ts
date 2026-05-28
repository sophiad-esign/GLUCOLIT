import { authConfigSchema } from "@workspace/auth";

import env from "../../env.config";

import type { AuthConfig } from "@workspace/auth";

const toBoolean = (value: boolean | string | undefined, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
};

export const authConfig = authConfigSchema.parse({
  providers: {
    password: toBoolean(env.NEXT_PUBLIC_AUTH_PASSWORD, true),
    magicLink: toBoolean(env.NEXT_PUBLIC_AUTH_MAGIC_LINK),
    emailOtp: toBoolean(env.NEXT_PUBLIC_AUTH_EMAIL_OTP),
    passkey: toBoolean(env.NEXT_PUBLIC_AUTH_PASSKEY),
    anonymous: toBoolean(env.NEXT_PUBLIC_AUTH_ANONYMOUS),
    oAuth: [],
  },
}) satisfies AuthConfig;
