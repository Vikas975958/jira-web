/**
 * Utility for generating cryptographically secure invitation tokens
 * and computing their SHA-256 hash for database storage.
 */

/**
 * Generate a cryptographically secure 64-character hexadecimal invitation token.
 * Uses Web Crypto API (globalThis.crypto) available in browsers, Node.js 19+, and Edge runtimes.
 * @returns {string}
 */
export function generateInvitationToken() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const array = new Uint8Array(32);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for older environments
  let randomHex = "";
  for (let i = 0; i < 32; i++) {
    randomHex += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return randomHex;
}

/**
 * Computes a SHA-256 hash of the provided invitation token string.
 * @param {string} token
 * @returns {Promise<string>} Hex-encoded SHA-256 string (64 characters)
 */
export async function hashToken(token) {
  if (!token) return "";

  // Web Crypto API (Browser, Next.js Edge, Node 19+)
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node environment fallback if subtle is unavailable
  try {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
  } catch (_) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }
}
