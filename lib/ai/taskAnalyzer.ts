import ai, { geminiFlash } from "@/lib/gemini";
import { uploadRemotePDF } from "@/lib/ai/uploadPdf";
import { uploadRemoteImage } from "@/lib/ai/uploadImage";

export interface TaskAttachment {
  file_path: string;
  file_type: string;
  file_name: string;
}

export interface TaskAnalysisInput {
  task_name: string;
  task_description: string | null;
  task_deadline: Date;
  task_priority: number;
  project_priority?: number | null;
  attachments?: TaskAttachment[];
}

export interface TaskAnalysisResult {
  confidence_score: number;
  grade_weight_percent: number | null;
  estimated_minutes: number;
  reasoning: {
    confidence: string;
    effort: string;
  };
}

const SYSTEM_PROMPT = `You are a task analysis assistant for a student productivity app.
Analyze the provided task data and return structured JSON only.
No preamble, no explanation, no text outside the JSON object.`;

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

async function buildContentParts(
  prompt: string,
  attachments: TaskAttachment[]
) {
  const parts: object[] = [{ text: prompt }];

  for (const attachment of attachments) {
    try {
      if (attachment.file_type === "application/pdf") {
        const file = await uploadRemotePDF(
          ai,
          attachment.file_path,
          attachment.file_name
        );
        if (file.uri) {
          parts.push({
            fileData: {
              fileUri: file.uri,
              mimeType: "application/pdf",
            },
          });
        }
      } else if (SUPPORTED_IMAGE_TYPES.includes(attachment.file_type)) {
        const { file, mimeType } = await uploadRemoteImage(
          ai,
          attachment.file_path,
          attachment.file_name
        );
        if (file.uri) {
          parts.push({
            fileData: {
              fileUri: file.uri,
              mimeType,
            },
          });
        }
      } else {
        console.warn(
          `Skipping unsupported attachment type: ${attachment.file_type} (${attachment.file_name})`
        );
      }
    } catch (error) {
      // A failed attachment upload should not kill the entire analysis
      console.error(
        `Failed to upload attachment ${attachment.file_name}:`,
        error
      );
    }
  }

  return parts;
}

export async function analyzeTask(
  input: TaskAnalysisInput
): Promise<TaskAnalysisResult> {
  const hoursUntilDeadline = Math.round(
    (input.task_deadline.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  const hasAttachments = input.attachments && input.attachments.length > 0;

  const prompt = `
  Analyze this student task and return the required JSON.

  Task name: ${input.task_name}
  Description: ${input.task_description ?? "No description provided"}
  Hours until deadline: ${hoursUntilDeadline}
  Student importance rating: ${input.task_priority} out of 5.0
  ${input.project_priority ? `Parent project priority: ${input.project_priority} out of 5.0` : ""}
  ${hasAttachments ? `Attached files: ${input.attachments!.length} file(s) provided. Use them as additional context for your analysis.` : ""}

  Return a JSON object with exactly these fields:
  {
    "confidence_score": <integer 1-10>,
    "grade_weight_percent": <number or null>,
    "estimated_minutes": <integer>,
    "reasoning": {
      "confidence": "<one sentence explaining the score>",
      "effort": "<one sentence explaining the estimate>"
    }
  }

  Rules for each field:

  confidence_score:
    1-3: Vague — no specifics, cannot start without clarification
    4-6: Partially defined — some detail but missing scope or steps
    7-10: Clearly defined — specific deliverables, clear scope
    If attached files provide additional clarity, adjust score upward accordingly.

  grade_weight_percent:
    Extract ONLY if explicitly stated as a percentage in the description or attached files.
    "worth 30% of my grade" → 30
    "final exam" → null
    Return null if not found anywhere.

  estimated_minutes:
    Realistic estimate for an average university student.
    - Short reading or review: 30-60
    - Problem sets: 60-180
    - Essay or written report: 120-300
    - Coding assignment: 120-360
    - Project milestone: 180-480
    - Exam preparation: 120-480
    If attached files reveal more scope than the description suggests, adjust upward.
    Minimum value: 15.
  `;

  let contents: object | string;

  if (hasAttachments) {
    const parts = await buildContentParts(prompt, input.attachments!);
    contents = [{ role: "user", parts }];
  } else {
    contents = prompt;
  }

  const response = await geminiFlash.generateContent({
    model: "gemini-2.5-flash",
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    },
    contents,
  });

  const raw = response.text;
  const parsed: TaskAnalysisResult = JSON.parse(raw ?? "{}");

  return {
    confidence_score: Math.max(1, Math.min(10, Math.round(parsed.confidence_score))),
    grade_weight_percent: parsed.grade_weight_percent ?? null,
    estimated_minutes: Math.max(15, Math.round(parsed.estimated_minutes)),
    reasoning: parsed.reasoning,
  };
}