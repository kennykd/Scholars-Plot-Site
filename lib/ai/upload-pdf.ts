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

// Generates a default PDF filename using the current timestamp.
function generateDefaultName(): string {
  return `document-${Date.now()}.pdf`;
}

// Downloads a PDF from a URL and saves it to a temporary file, returning the path and cleanup function.
async function downloadPdfToTempFile(url: string, displayName: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF from URL. Status: ${response.status}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "gemini-pdf-"));

  let sourceName: string | null = extractFileNameFromHeaders(response.headers);
  if (!sourceName) {
    const urlName = basename(new URL(url).pathname);
    if (urlName && urlName.includes(".")) {
      sourceName = urlName;
    }
  }

  if (!sourceName) {
    sourceName = `${sanitizeFileStem(displayName)}-${generateDefaultName()}`;
  }

  const stem = sanitizeFileStem(sourceName).replace(/\.pdf$/i, "");
  const filePath = join(tempDir, `${stem}.pdf`);

  // Streams file to disk instead of loading into memory to handle large PDFs efficiently.
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
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

// Uploads a PDF from a URL or local path to Google's file API and waits for processing to complete.
export async function uploadRemotePDF(ai: GoogleGenAI, source: string, displayName = generateDefaultName()) {
  let filePath = source;
  let cleanup: (() => Promise<void>) | null = null;

  // URL sources are normalized to a local temp file so upload path logic is the same for both origins.
  if (isHttpUrl(source)) {
    const tempFile = await downloadPdfToTempFile(source, displayName);
    filePath = tempFile.filePath;
    cleanup = tempFile.cleanup;
  }

  try {
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: {
        displayName,
        mimeType: "application/pdf",
      },
    });
    if (!uploadedFile.name) {
      throw new Error("File upload did not return a file name.");
    }

    let processedFile = await ai.files.get({ name: uploadedFile.name });
    // Polls the file API until processing completes before returning the file.
    while (processedFile.state === "PROCESSING") {
      await sleep(FILE_POLL_INTERVAL_MS);
      processedFile = await ai.files.get({ name: uploadedFile.name });
    }

    if (processedFile.state === "FAILED") {
      throw new Error("File processing failed.");
    }

    return processedFile;
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}
