// This file contains example code demonstrating how to use the Google GenAI API client to upload
// attachments and generate AI recommendations based on user context and attached documents.
// It includes functions for classifying attachments, uploading them, and generating AI responses
// with specific configurations.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { toJSONSchema } from "zod";
import { uploadRemoteImage } from "./uploadImage";
import { uploadRemotePDF } from "./uploadPdf";
import { aiResponseSchema } from "../validation/ai";

// Client gets the API key from the environment variable GEMINI_API_KEY.
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

// Supported image extensions for attachment auto-classification.
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function getExtensionFromSource(source: string): string {
  try {
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return (new URL(source).pathname.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
    }
  } catch {
    // Fall back to direct path parsing when URL parsing fails.
  }

  return (source.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
}

function classifyAttachment(source: string): "pdf" | "image" {
  const extension = getExtensionFromSource(source);
  if (extension === ".pdf") {
    return "pdf";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  throw new Error(`Unsupported attachment type for source: ${source}`);
}

type PromptPart = { text: string } | { fileData: { mimeType: string; fileUri: string } };

type SplitAttachment = { source: string; index: number };

type UploadedAttachment = {
  index: number;
  mimeType: string;
  fileUri: string;
};

function splitAttachments(attachments: string[]) {
  return attachments.reduce(
    (acc, source, index) => {
      const classified = classifyAttachment(source);
      if (classified === "pdf") {
        acc.pdfs.push({ source, index });
      } else {
        acc.images.push({ source, index });
      }

      return acc;
    },
    {
      pdfs: [] as SplitAttachment[],
      images: [] as SplitAttachment[],
    }
  );
}

export async function uploadAttachments(attachments: string[]): Promise<PromptPart[]> {
  if (!attachments.length) {
    return [];
  }

  // Single-pass split keeps one public attachments API while preserving type-specific upload logic.
  const split = splitAttachments(attachments);

  const uploadedPdfs = await Promise.all(
    split.pdfs.map(async ({ source, index }): Promise<UploadedAttachment> => {
      // Each file keeps its original index so mixed image/PDF ordering can be restored later.
      const uploadedPdf = await uploadRemotePDF(ai, source, `reference-document-${index + 1}`);
      if (!uploadedPdf.uri) {
        throw new Error("Uploaded PDF does not have a URI.");
      }

      return {
        index,
        mimeType: "application/pdf",
        fileUri: uploadedPdf.uri,
      };
    })
  );

  const uploadedImages = await Promise.all(
    split.images.map(async ({ source, index }): Promise<UploadedAttachment> => {
      const uploadedImage = await uploadRemoteImage(ai, source, `reference-image-${index + 1}`);
      if (!uploadedImage.file.uri) {
        throw new Error("Uploaded image does not have a URI.");
      }

      return {
        index,
        mimeType: uploadedImage.mimeType,
        fileUri: uploadedImage.file.uri,
      };
    })
  );

  return [...uploadedPdfs, ...uploadedImages]
    .sort((a, b) => a.index - b.index)
    .map(({ mimeType, fileUri }) => ({
      fileData: {
        mimeType,
        fileUri,
      },
    }));
}

export async function aiRecommend(
  context: string,
  attachments?: string[]
) {
  const promptParts: PromptPart[] = [
    {
      text: [
        "Use the user context and all attached PDF and image documents together as one prompt.",
        "User context:",
        context,
      ].join("\n\n"),
    },
    ...(attachments?.length ? await uploadAttachments(attachments) : []),
  ];

  const contents = [
    {
      role: "user",
      parts: promptParts,
    },
  ];

  // Configures parameters for the model's response that allows the model to be tailored in order to better suit the user's needs and preferences.
  const config = {
    // Controls the level of reasoning and creativity in the model's response.
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    // Provides additional context to the model to guide its response.
    systemInstruction: "You are a helpful assistant that arranges schedules and manages tasks and study sessions for the user. Take into account the user's preferences and constraints when generating recommendations, and manage their workload effectively. Ensure that the user does not exceed their capacity and maintains a healthy work-life balance. Use the provided context and tools to generate your response.",
    // Allows the model to access external information or perform actions, which can enhance its response.
    tools: [
      { googleSearch: {} },
      { urlContext: {} },
    ],
    responseMimeType: "application/json",
    responseJsonSchema: toJSONSchema(aiResponseSchema),
  };

  // Generates the content made by the model.
  const response = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: config,
  });

  console.log(response);
  return response;
}