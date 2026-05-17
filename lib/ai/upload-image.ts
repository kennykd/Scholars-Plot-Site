import type { GoogleGenAI } from "@google/genai";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

// Polling interval for checking file processing status in milliseconds.
const FILE_POLL_INTERVAL_MS = 5000;
// Maps MIME types to their canonical file extensions.
const CANONICAL_IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg" as const,
  "image/png": ".png" as const,
  "image/webp": ".webp" as const,
  "image/gif": ".gif" as const,
} as const;

// Maps file extensions to their MIME types.
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Utility function to pause execution for a specified number of milliseconds.
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Checks if a string is a valid HTTP or HTTPS URL.
function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Removes file extension and sanitizes the filename to contain only alphanumeric, dash, and underscore characters.
function sanitizeFileStem(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "document";
}

// Extracts the filename from the Content-Disposition response header.
function extractFileNameFromHeaders(headers: Headers): string | null {
  const disposition = headers.get("content-disposition");
  if (!disposition) return null;

  const match = disposition.match(/filename="?(.+?)"?$/);
  return match ? match[1] : null;
}

// Extracts the file extension from a file path.
function getExtensionFromPath(filePath: string): string {
  const extensionMatch = basename(filePath).match(/\.[^.]+$/);
  return extensionMatch ? extensionMatch[0].toLowerCase() : "";
}

// Determines the MIME type of an image from server content type or file extension.
function getImageMimeType(source: string, contentType?: string | null): string {
  // Prefer server-provided content type when present; fall back to extension mapping.
  if (contentType?.startsWith("image/")) {
    return contentType;
  }

  const ext = getExtensionFromPath(source);
  return IMAGE_MIME_BY_EXT[ext] ?? "image/jpeg";
}

// Returns the canonical file extension for a given MIME type.
function getImageExtensionFromMimeType(mimeType: string): string {
  return CANONICAL_IMAGE_EXTENSIONS[mimeType as keyof typeof CANONICAL_IMAGE_EXTENSIONS] ?? ".jpg";
}

// Generates a default image filename using the current timestamp.
function generateDefaultImageName(): string {
  return `image-${Date.now()}`;
}

// Downloads an image from a URL and saves it to a temporary file, returning the path and cleanup function.
async function downloadImageToTempFile(url: string, displayName: string): Promise<{ filePath: string; mimeType: string; cleanup: () => Promise<void> }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from URL. Status: ${response.status}`);
  }

  const mimeType = getImageMimeType(url, response.headers.get("content-type"));
  const extension = getImageExtensionFromMimeType(mimeType);
  const tempDir = await mkdtemp(join(tmpdir(), "gemini-image-"));

  let sourceName: string | null = extractFileNameFromHeaders(response.headers);
  if (!sourceName) {
    const urlName = basename(new URL(url).pathname);
    if (urlName && urlName.includes(".")) {
      sourceName = urlName;
    }
  }

  if (!sourceName) {
    sourceName = `${sanitizeFileStem(displayName)}-${Date.now()}${extension}`;
  }

  const stem = sanitizeFileStem(sourceName).replace(/\.[^.]+$/, "");
  const filePath = join(tempDir, `${stem}${extension}`);

  // Streams file to disk instead of loading into memory to handle large images efficiently.
  if (response.body) {
    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream),
      createWriteStream(filePath)
    );
  } else {
    const data = new Uint8Array(await response.arrayBuffer());
    await writeFile(filePath, data);
  }

  return {
    filePath,
    mimeType,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

// Uploads an image from a URL or local path to Google's file API and waits for processing to complete.
export async function uploadRemoteImage(ai: GoogleGenAI, source: string, displayName = generateDefaultImageName()) {
  let filePath = source;
  let mimeType = getImageMimeType(source);
  let cleanup: (() => Promise<void>) | null = null;

  if (isHttpUrl(source)) {
    const tempFile = await downloadImageToTempFile(source, displayName);
    filePath = tempFile.filePath;
    mimeType = tempFile.mimeType;
    cleanup = tempFile.cleanup;
  }

  try {
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: {
        displayName,
        mimeType,
      },
    });

    if (!uploadedFile.name) {
      throw new Error("Image upload did not return a file name.");
    }

    let processedFile = await ai.files.get({ name: uploadedFile.name });
    // Polls the file API until processing completes before returning the file.
    while (processedFile.state === "PROCESSING") {
      await sleep(FILE_POLL_INTERVAL_MS);
      processedFile = await ai.files.get({ name: uploadedFile.name });
    }

    if (processedFile.state === "FAILED") {
      throw new Error("Image processing failed.");
    }

    return {
      file: processedFile,
      mimeType,
    };
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}
