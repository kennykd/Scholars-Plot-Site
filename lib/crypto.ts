import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits is standard for GCM

const rawKey = process.env.ENCRYPTION_KEY || "default-dev-encryption-key-for-local-development-only";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(rawKey).digest();

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the format `iv:authTag:ciphertext` in hex.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string of format `iv:authTag:ciphertext` back to plaintext.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error("Cannot decrypt empty value");
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format. Expected iv:authTag:ciphertext");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
