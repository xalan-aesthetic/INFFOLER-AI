/**
 * INFFOLER AI 2.0 — Multi-Provider Auth Helpers (Microsoft, Phone OTP, Apple, Google, Email)
 * Creator: Alankrit Pathak
 *
 * Pure helpers & client-side rate-limit/validation guards for multi-provider authentication.
 * Real cryptographic token validation & secret storage stay exclusively in Firebase Auth & Cloudflare Worker.
 */

export const OTP_RESEND_COOLDOWN_SEC = 45;
export const OTP_SESSION_EXPIRY_SEC = 300;
export const MAX_OTP_SEND_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const MAX_OTP_VERIFY_ATTEMPTS = 5;

export const PHONE_COUNTRIES = Object.freeze([
  { code: "+91", iso: "IN", label: "India (+91)", minDigits: 10, maxDigits: 10 },
  { code: "+1", iso: "US", label: "United States / Canada (+1)", minDigits: 10, maxDigits: 10 },
  { code: "+44", iso: "GB", label: "United Kingdom (+44)", minDigits: 10, maxDigits: 10 },
  { code: "+971", iso: "AE", label: "UAE (+971)", minDigits: 9, maxDigits: 9 },
  { code: "+65", iso: "SG", label: "Singapore (+65)", minDigits: 8, maxDigits: 8 },
  { code: "+61", iso: "AU", label: "Australia (+61)", minDigits: 9, maxDigits: 9 },
  { code: "+49", iso: "DE", label: "Germany (+49)", minDigits: 10, maxDigits: 11 },
  { code: "+33", iso: "FR", label: "France (+33)", minDigits: 9, maxDigits: 9 },
  { code: "+81", iso: "JP", label: "Japan (+81)", minDigits: 10, maxDigits: 10 },
  { code: "+82", iso: "KR", label: "South Korea (+82)", minDigits: 9, maxDigits: 10 },
  { code: "+977", iso: "NP", label: "Nepal (+977)", minDigits: 10, maxDigits: 10 },
  { code: "+880", iso: "BD", label: "Bangladesh (+880)", minDigits: 10, maxDigits: 10 },
  { code: "+94", iso: "LK", label: "Sri Lanka (+94)", minDigits: 9, maxDigits: 9 },
  { code: "+60", iso: "MY", label: "Malaysia (+60)", minDigits: 9, maxDigits: 10 },
  { code: "+62", iso: "ID", label: "Indonesia (+62)", minDigits: 9, maxDigits: 12 },
  { code: "+27", iso: "ZA", label: "South Africa (+27)", minDigits: 9, maxDigits: 9 },
  { code: "+55", iso: "BR", label: "Brazil (+55)", minDigits: 10, maxDigits: 11 },
]);

export function normalizePhoneInput(rawNumber, countryCode = "+91") {
  const cc = String(countryCode || "+91").trim();
  const cleaned = String(rawNumber || "").trim().replace(/[\s\-().]/g, "");
  if (!cleaned) {
    return { ok: false, error: "Please enter your mobile number." };
  }

  let e164 = "";
  let nationalDigits = "";

  if (cleaned.startsWith("+")) {
    e164 = "+" + cleaned.slice(1).replace(/\D/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      return {
        ok: false,
        error: "Enter a valid international phone number including country code (e.g., +919876543210).",
      };
    }
    if (e164.startsWith("+91")) {
      nationalDigits = e164.slice(3);
      if (!/^[6-9]\d{9}$/.test(nationalDigits)) {
        return {
          ok: false,
          error: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
        };
      }
    }
    return { ok: true, e164 };
  }

  const digits = cleaned.replace(/\D/g, "").replace(/^0+/, "");
  const cleanCc = cc.startsWith("+") ? cc : `+${cc.replace(/\D/g, "")}`;
  if (!/^\+[1-9]\d{0,3}$/.test(cleanCc)) {
    return { ok: false, error: "Please select a valid country code." };
  }

  if (cleanCc === "+91") {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        ok: false,
        error: "Enter a valid 10-digit Indian mobile number (e.g., 9876543210).",
      };
    }
    return { ok: true, e164: `+91${digits}` };
  }

  const countryMeta = PHONE_COUNTRIES.find(c => c.code === cleanCc);
  const minLen = countryMeta?.minDigits || 6;
  const maxLen = countryMeta?.maxDigits || 13;
  if (digits.length < minLen || digits.length > maxLen) {
    return {
      ok: false,
      error: `Enter a valid ${countryMeta ? countryMeta.label : cleanCc} phone number (${minLen}-${maxLen} digits).`,
    };
  }

  e164 = `${cleanCc}${digits}`;
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    return { ok: false, error: "Invalid phone number format." };
  }
  return { ok: true, e164 };
}

export function validateOtpCode(rawCode) {
  const digits = String(rawCode || "").trim().replace(/\s+/g, "");
  if (!digits) {
    return { ok: false, error: "Please enter the 6-digit verification code sent to your phone." };
  }
  if (!/^\d{6}$/.test(digits)) {
    return { ok: false, error: "Verification code must be a valid 6-digit number." };
  }
  return { ok: true, code: digits };
}

const SORTED_COUNTRY_CODES = PHONE_COUNTRIES.map(c => c.code).sort((a, b) => b.length - a.length);

export function maskPhoneNumber(phone) {
  const s = String(phone || "").trim();
  if (!s) return "";
  if (s.length <= 4) return "••••";
  const matchedCode = SORTED_COUNTRY_CODES.find(code => s.startsWith(code));
  if (matchedCode) {
    return `${matchedCode} ••••••${s.slice(-4)}`;
  }
  const fallbackMatch = s.match(/^(\+\d{1,2})/);
  const prefix = fallbackMatch ? `${fallbackMatch[1]} ` : "";
  return `${prefix}••••••${s.slice(-4)}`;
}

export function isApplePrivateRelayEmail(email) {
  return String(email || "").trim().toLowerCase().endsWith("@privaterelay.appleid.com");
}

export function resolveDisplayIdentity(user) {
  if (!user) {
    return { displayName: "INFFOLER User", subtitle: "", isPrivateRelay: false };
  }
  const providers = (user.providerData || []).map(p => p.providerId);
  const isPrivateRelay = isApplePrivateRelayEmail(user.email);
  const maskedPhone = user.phoneNumber ? maskPhoneNumber(user.phoneNumber) : "";

  let displayName = user.displayName || "";
  if (!displayName) {
    if (user.email) {
      displayName = isPrivateRelay ? "Apple Explorer" : user.email.split("@")[0];
    } else if (user.phoneNumber) {
      displayName = `Mobile ${user.phoneNumber.slice(-4)}`;
    } else if (providers.includes("apple.com")) {
      displayName = "Apple User";
    } else if (providers.includes("microsoft.com")) {
      displayName = "Microsoft User";
    } else {
      displayName = "INFFOLER Explorer";
    }
  }

  let subtitle = "Verified Firebase User";
  if (user.email) {
    subtitle = isPrivateRelay ? `Apple Private Relay · ${user.email}` : user.email;
  } else if (maskedPhone) {
    subtitle = `Verified Phone · ${maskedPhone}`;
  }

  return {
    displayName: displayName.slice(0, 80),
    subtitle,
    maskedPhone,
    isPrivateRelay,
    providers,
  };
}

export function getProviderBadgeList(user) {
  const providers = new Set((user?.providerData || []).map(p => p.providerId));
  const badges = [];
  if (providers.has("google.com")) badges.push({ id: "google.com", label: "Google Linked", tone: "cyan" });
  if (providers.has("microsoft.com")) badges.push({ id: "microsoft.com", label: "Microsoft Linked", tone: "blue" });
  if (providers.has("apple.com")) {
    badges.push({ id: "apple.com", label: "Apple Linked", tone: "teal" });
    if (isApplePrivateRelayEmail(user?.email)) {
      badges.push({ id: "apple-relay", label: "Private Relay Email", tone: "purple" });
    }
  }
  if (providers.has("phone") || user?.phoneNumber) {
    badges.push({ id: "phone", label: "Phone OTP Verified", tone: "teal" });
  }
  if (providers.has("password")) badges.push({ id: "password", label: "Email & Password", tone: "purple" });
  return badges;
}

export class OtpRateLimiter {
  constructor({
    cooldownSec = OTP_RESEND_COOLDOWN_SEC,
    expirySec = OTP_SESSION_EXPIRY_SEC,
    maxSendPerWindow = MAX_OTP_SEND_PER_WINDOW,
    sendWindowMs = OTP_SEND_WINDOW_MS,
    maxVerifyAttempts = MAX_OTP_VERIFY_ATTEMPTS,
  } = {}) {
    this.cooldownSec = cooldownSec;
    this.expirySec = expirySec;
    this.maxSendPerWindow = maxSendPerWindow;
    this.sendWindowMs = sendWindowMs;
    this.maxVerifyAttempts = maxVerifyAttempts;
    this.sendTimestamps = [];
    this.lastSendAt = 0;
    this.expiresAt = 0;
    this.verifyAttempts = 0;
  }

  canSendOtp(nowMs = Date.now()) {
    this.sendTimestamps = this.sendTimestamps.filter(ts => nowMs - ts < this.sendWindowMs);
    if (this.lastSendAt > 0) {
      const elapsedSec = Math.floor((nowMs - this.lastSendAt) / 1000);
      const remaining = this.cooldownSec - elapsedSec;
      if (remaining > 0) {
        return {
          allowed: false,
          waitSec: remaining,
          reason: `Please wait ${remaining}s before requesting another OTP.`,
        };
      }
    }
    if (this.sendTimestamps.length >= this.maxSendPerWindow) {
      const oldest = this.sendTimestamps[0];
      const waitSec = Math.max(1, Math.ceil((this.sendWindowMs - (nowMs - oldest)) / 1000));
      return {
        allowed: false,
        waitSec,
        reason: `Too many OTP requests. Please wait ${Math.ceil(waitSec / 60)} minute(s) before trying again.`,
      };
    }
    return { allowed: true, waitSec: 0 };
  }

  recordOtpSent(nowMs = Date.now()) {
    this.sendTimestamps = this.sendTimestamps.filter(ts => nowMs - ts < this.sendWindowMs);
    this.sendTimestamps.push(nowMs);
    this.lastSendAt = nowMs;
    this.expiresAt = nowMs + this.expirySec * 1000;
    this.verifyAttempts = 0;
  }

  canAttemptVerify(nowMs = Date.now()) {
    if (this.expiresAt > 0 && nowMs > this.expiresAt) {
      return {
        allowed: false,
        expired: true,
        reason: "This OTP has expired. Please tap Resend OTP for a new verification code.",
      };
    }
    if (this.verifyAttempts >= this.maxVerifyAttempts) {
      return {
        allowed: false,
        locked: true,
        reason: "Too many incorrect OTP attempts. Please request a fresh verification code.",
      };
    }
    return { allowed: true };
  }

  recordFailedVerifyAttempt() {
    this.verifyAttempts += 1;
    return Math.max(0, this.maxVerifyAttempts - this.verifyAttempts);
  }

  resetChallenge() {
    this.expiresAt = 0;
    this.verifyAttempts = 0;
  }

  getCooldownRemainingSec(nowMs = Date.now()) {
    if (!this.lastSendAt) return 0;
    return Math.max(0, this.cooldownSec - Math.floor((nowMs - this.lastSendAt) / 1000));
  }

  getExpiryRemainingSec(nowMs = Date.now()) {
    if (!this.expiresAt) return 0;
    return Math.max(0, Math.ceil((this.expiresAt - nowMs) / 1000));
  }
}

function sanitizeFirebaseRawMessage(rawMessage) {
  return String(rawMessage || "")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED_KEY]")
    .trim();
}

function extractFirebaseErrorDetail(rawMessage) {
  let detail = sanitizeFirebaseRawMessage(rawMessage);
  if (!detail) return "";
  detail = detail
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(auth\/[a-z0-9-]+\)\.?$/i, "")
    .replace(/^OPERATION_NOT_ALLOWED\s*:\s*/i, "")
    .trim();
  return detail;
}

function isGenericProviderDisabledMessage(detail) {
  if (!detail) return true;
  return /given sign-in provider is disabled|identity provider configuration is disabled|operation-not-allowed/i.test(
    detail
  );
}

function withRealFirebaseError(friendlyText, code, rawMessage) {
  const cleanMsg = sanitizeFirebaseRawMessage(rawMessage);
  if (code && cleanMsg) {
    return `${friendlyText} [${code}: ${cleanMsg}]`;
  }
  if (code) {
    return `${friendlyText} [${code}]`;
  }
  if (cleanMsg && !friendlyText.includes(cleanMsg)) {
    return `${friendlyText} (${cleanMsg})`;
  }
  return friendlyText;
}

export function mapMultiProviderAuthError(err, contextProvider = "", configContext = {}) {
  const code = String(err?.code || "").trim();
  const msg = sanitizeFirebaseRawMessage(err?.message || err?.customData?.message || "");
  const projectSuffix = configContext?.projectId ? ` on project "${configContext.projectId}"` : "";
  const providerName =
    contextProvider === "microsoft.com"
      ? "Microsoft"
      : contextProvider === "apple.com"
        ? "Apple"
        : contextProvider === "phone"
          ? "Phone OTP"
          : "Authentication";

  const formatOperationNotAllowed = () => {
    const detail = extractFirebaseErrorDetail(msg);
    if (/region|sms unable to be sent|country/i.test(detail)) {
      return withRealFirebaseError(
        `SMS OTP for this country/region is restricted by Firebase SMS Region Policy${projectSuffix}. Enable this region (e.g., India +91) in Firebase Console → Authentication → Settings → SMS region policy.`,
        code || "auth/operation-not-allowed",
        detail
      );
    }
    if (/billing|blaze|upgrade|tier/i.test(detail)) {
      return withRealFirebaseError(
        `Firebase Phone Auth requires active SMS billing / Blaze configuration${projectSuffix}.`,
        code || "auth/operation-not-allowed",
        detail
      );
    }
    if (detail && !isGenericProviderDisabledMessage(detail)) {
      return withRealFirebaseError(
        `${providerName} sign-in was rejected by Firebase${projectSuffix}.`,
        code || "auth/operation-not-allowed",
        detail
      );
    }
    if (contextProvider === "phone") {
      return withRealFirebaseError(
        `Firebase rejected Phone OTP${projectSuffix}. Check Firebase Console → Authentication → Settings → SMS region policy (allow India +91 / destination country), Authorized domains, and E.164 test phone format.`,
        code || "auth/operation-not-allowed",
        msg
      );
    }
    return withRealFirebaseError(
      `${providerName} sign-in was rejected by Firebase${projectSuffix}. Verify provider setup in Firebase Console → Authentication → Sign-in method.`,
      code || "auth/operation-not-allowed",
      msg
    );
  };

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return withRealFirebaseError(
        "Sign-in window was closed before finishing. No changes were made.",
        code,
        msg
      );
    case "auth/operation-not-allowed":
      return formatOperationNotAllowed();
    case "auth/unauthorized-domain":
      return withRealFirebaseError(
        "This domain must be added in Firebase Console → Authentication → Settings → Authorized domains.",
        code,
        msg
      );
    case "auth/account-exists-with-different-credential": {
      const existingEmail = err?.customData?.email ? ` (${err.customData.email})` : "";
      return withRealFirebaseError(
        `An account with that email${existingEmail} already exists using a different sign-in method. Sign in with your original method first, then link ${providerName} inside Profile & Settings to protect your account.`,
        code,
        msg
      );
    }
    case "auth/credential-already-in-use":
      return withRealFirebaseError(
        `This ${providerName} identity is already linked to a different INFFOLER AI account.`,
        code,
        msg
      );
    case "auth/provider-already-linked":
      return withRealFirebaseError(`${providerName} is already linked to your account.`, code, msg);
    case "auth/email-already-in-use":
      return withRealFirebaseError(
        "That email is already registered. Try signing in or resetting your password.",
        code,
        msg
      );
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return withRealFirebaseError(
        "Invalid email or password. Double-check your details or reset your password.",
        code,
        msg
      );
    case "auth/weak-password":
      return withRealFirebaseError("Password must be at least 6 characters long.", code, msg);
    case "auth/invalid-email":
      return withRealFirebaseError("Please enter a valid email address.", code, msg);
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return withRealFirebaseError(
        "Please enter a valid mobile number with country code (e.g., +91 9876543210).",
        code,
        msg
      );
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
      if (typeof err?.otpAttemptsRemaining === "number") {
        if (err.otpAttemptsRemaining <= 0) {
          return withRealFirebaseError(
            "Too many incorrect OTP attempts. Please request a fresh verification code.",
            code,
            msg
          );
        }
        return withRealFirebaseError(
          `Incorrect 6-digit OTP code. ${err.otpAttemptsRemaining} attempt${err.otpAttemptsRemaining === 1 ? "" : "s"} remaining before needing a new code.`,
          code,
          msg
        );
      }
      return withRealFirebaseError(
        "Incorrect 6-digit OTP code. Please double-check the SMS and try again.",
        code,
        msg
      );
    case "auth/code-expired":
    case "auth/session-expired":
      return withRealFirebaseError(
        "Verification OTP has expired. Tap Resend OTP to receive a new code.",
        code,
        msg
      );
    case "auth/captcha-check-failed":
      return withRealFirebaseError(
        "Security verification (reCAPTCHA) failed or expired. Please try requesting the OTP again.",
        code,
        msg
      );
    case "auth/invalid-app-credential":
    case "auth/missing-client-identifier":
    case "auth/app-not-authorized":
      return withRealFirebaseError(
        "Phone authentication could not verify this domain/reCAPTCHA session. Refresh the page and verify Authorized domains in Firebase Console.",
        code,
        msg
      );
    case "auth/quota-exceeded":
      return withRealFirebaseError(
        "SMS OTP quota has been temporarily reached. Please try again later or test with a Firebase test phone number.",
        code,
        msg
      );
    case "auth/too-many-requests":
      return withRealFirebaseError(
        "Too many verification attempts. Please wait a few minutes before retrying.",
        code,
        msg
      );
    case "auth/network-request-failed":
      return withRealFirebaseError(
        "Network error while contacting Firebase Authentication. Check your internet connection and try again.",
        code,
        msg
      );
    case "auth/user-disabled":
      return withRealFirebaseError("This account has been disabled in Firebase Authentication.", code, msg);
    case "auth/internal-error":
      return withRealFirebaseError(
        "Temporary authentication service error. Verify your number format and try again.",
        code,
        msg
      );
    case "auth/requires-recent-login":
      return withRealFirebaseError(
        "For your security, please log out and sign back in right before making this change.",
        code,
        msg
      );
    case "auth/web-storage-unsupported":
      return withRealFirebaseError(
        "Browser storage is blocked. Enable cookies/storage or avoid private/incognito restrictions and try again.",
        code,
        msg
      );
    case "permission-denied":
      return withRealFirebaseError(
        "Cloud permission check denied. Make sure you are signed in to your own account.",
        code,
        msg
      );
    default:
      if (/operation-not-allowed/i.test(msg)) {
        return formatOperationNotAllowed();
      }
      if (/network/i.test(msg)) {
        return withRealFirebaseError(
          "Network error occurred while verifying your session. Check your connection and try again.",
          code,
          msg
        );
      }
      if (code) {
        return withRealFirebaseError("Firebase authentication error.", code, msg);
      }
      return msg || "Authentication or cloud sync error occurred.";
  }
}
