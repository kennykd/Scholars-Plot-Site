import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips plaintext through encrypt -> decrypt", () => {
    const plaintext = "42";
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips multi-character and unicode strings", () => {
    const plaintext = "streak:7 — josé 🎉";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces the iv:authTag:ciphertext hex format", () => {
    const ciphertext = encrypt("100");
    const parts = ciphertext.split(":");

    expect(parts).toHaveLength(3);
    parts.forEach((part) => expect(part).toMatch(/^[0-9a-f]+$/));
    // 12-byte IV => 24 hex chars; 16-byte GCM auth tag => 32 hex chars.
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
  });

  it("uses a fresh IV so the same plaintext encrypts differently each time", () => {
    expect(encrypt("5")).not.toBe(encrypt("5"));
  });

  it("throws when decrypting an empty value", () => {
    expect(() => decrypt("")).toThrow("Cannot decrypt empty value");
  });

  it("throws on malformed ciphertext (wrong number of segments)", () => {
    expect(() => decrypt("not-a-valid-ciphertext")).toThrow(
      "Invalid ciphertext format",
    );
  });

  it("throws when the ciphertext has been tampered with (auth tag mismatch)", () => {
    const [iv, authTag, data] = encrypt("123").split(":");
    // Flip the last hex digit of the ciphertext body.
    const lastChar = data[data.length - 1];
    const tampered = data.slice(0, -1) + (lastChar === "0" ? "1" : "0");

    expect(() => decrypt(`${iv}:${authTag}:${tampered}`)).toThrow();
  });
});
