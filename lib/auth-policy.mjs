// Default to the verified flow unless the operator explicitly enables the pilot workaround.
export const requireEmailVerification = (env = process.env) =>
  env.REQUIRE_EMAIL_VERIFICATION !== "false";
