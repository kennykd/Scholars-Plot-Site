import ai, { geminiFlash } from '@/lib/gemini';
import { uploadRemoteImage } from '@/lib/ai/uploadImage';
import { uploadRemotePDF } from '@/lib/ai/uploadPdf';
import { toJSONSchema, z } from 'zod';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

type GeminiPart = { text: string } | { fileData: { fileUri: string; mimeType: string } };

export type DraftAttachmentInput = {
  fileName: string;
  fileType: string;
  url: string;
};

export type SkippedAttachment = {
  fileName: string;
  fileType: string;
  reason: string;
};

export type TaskDraftInput = {
  title: string;
  description?: string | null;
  deadline?: Date | null;
  priority?: number | null;
  attachments?: DraftAttachmentInput[];
};

export type TaskDraftResult = {
  title: string;
  description: string;
  priority: number;
  reasoning: string;
  skippedAttachments: SkippedAttachment[];
};

export type StudyTrackDraftInput = {
  task: {
    id: number;
    title: string;
    description: string | null;
    deadline: Date;
    priority: number;
  };
  preferences: {
    focus_minutes: number;
    break_minutes: number;
    total_pomodoros: number;
    total_minutes: number;
  };
  availability: {
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[];
  behaviorProfile: object | null;
  attachments?: DraftAttachmentInput[];
};

export type StudyTrackDraftResult = {
  tracks: StudyTrackDraftTrack[];
  warnings: string[];
  reasoning: string;
  skippedAttachments: SkippedAttachment[];
};

export type StudyTrackDraftTrack = {
  title: string;
  start_date: string;
  repeat: 'none' | 'weekly' | 'biweekly';
  time: string;
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  notes: string;
  description_as_checklist: boolean;
};

const taskDraftSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(4000).default(''),
  priority: z.coerce.number().min(0.5).max(5),
  reasoning: z.string().max(1200).default(''),
});

const studyTrackSchema = z.object({
  title: z.string().min(1).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repeat: z.enum(['none', 'weekly', 'biweekly']).default('none'),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  focus_minutes: z.coerce.number().int().min(1).max(240),
  break_minutes: z.coerce.number().int().min(0).max(120),
  total_pomodoros: z.coerce.number().int().min(1).max(12),
  notes: z.string().max(3000).default(''),
  description_as_checklist: z.coerce.boolean().default(false),
});

const studyTrackDraftSchema = z.object({
  tracks: z.array(studyTrackSchema).min(1).max(8),
  warnings: z.array(z.string().max(500)).default([]),
  reasoning: z.string().max(1200).default(''),
});

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseModelJson(raw: string | undefined) {
  const text = raw?.trim() ?? '{}';
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced?.[1] ?? text);
}

async function buildAttachmentParts(
  attachments: DraftAttachmentInput[] = [],
): Promise<{ parts: GeminiPart[]; skippedAttachments: SkippedAttachment[] }> {
  const parts: GeminiPart[] = [];
  const skippedAttachments: SkippedAttachment[] = [];

  for (const attachment of attachments) {
    try {
      if (attachment.fileType === 'application/pdf') {
        const file = await uploadRemotePDF(ai, attachment.url, attachment.fileName);
        if (file.uri) {
          parts.push({
            fileData: {
              fileUri: file.uri,
              mimeType: 'application/pdf',
            },
          });
        }
        continue;
      }

      if (SUPPORTED_IMAGE_TYPES.has(attachment.fileType)) {
        const { file, mimeType } = await uploadRemoteImage(
          ai,
          attachment.url,
          attachment.fileName,
        );
        if (file.uri) {
          parts.push({
            fileData: {
              fileUri: file.uri,
              mimeType,
            },
          });
        }
        continue;
      }

      skippedAttachments.push({
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        reason: 'Unsupported file type',
      });
    } catch {
      skippedAttachments.push({
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        reason: 'Could not process attachment',
      });
    }
  }

  return { parts, skippedAttachments };
}

export async function generateTaskDraft(input: TaskDraftInput): Promise<TaskDraftResult> {
  const { parts: attachmentParts, skippedAttachments } = await buildAttachmentParts(
    input.attachments,
  );

  const prompt = [
    'Draft improved form values for a student task.',
    'Use the current title and description first. Use attached PDFs/images only as supporting context.',
    'Return concise values that can be placed directly into a task form.',
    '',
    `Current title: ${input.title || 'Untitled task'}`,
    `Current description: ${input.description || 'No description provided'}`,
    `Deadline: ${input.deadline?.toISOString() ?? 'No deadline provided'}`,
    `Current priority: ${input.priority ?? 'Not set'} out of 5`,
  ].join('\n');

  const response = await geminiFlash.generateContent({
    model: 'gemma-4-31b-it',
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: toJSONSchema(taskDraftSchema),
      systemInstruction:
        'You draft student task form fields. Return only JSON that matches the schema.',
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...attachmentParts],
      },
    ],
  });

  const parsed = taskDraftSchema.parse(parseModelJson(response.text));
  return {
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    priority: clamp(Number(parsed.priority), 0.5, 5),
    reasoning: parsed.reasoning.trim(),
    skippedAttachments,
  };
}

export async function generateStudyTrackDraft(
  input: StudyTrackDraftInput,
): Promise<StudyTrackDraftResult> {
  const { parts: attachmentParts, skippedAttachments } = await buildAttachmentParts(
    input.attachments,
  );

  const prompt = [
    'Create an optimal study-session track for this task.',
    'Return tracks that match the batch creation payload fields exactly.',
    'Schedule sessions before the task deadline and respect user availability when it exists.',
    '<user_input>',
    `Task id: ${input.task.id}`,
    `Task title: ${input.task.title}`,
    `Task description: ${input.task.description ?? 'No description provided'}`,
    `Deadline: ${input.task.deadline.toISOString()}`,
    `Priority: ${input.task.priority} out of 5`,
    `Study preferences: ${JSON.stringify(input.preferences)}`,
    `Availability: ${JSON.stringify(input.availability)}`,
    `Behavior profile: ${JSON.stringify(input.behaviorProfile)}`,
    '<user_input>'
  ].join('\n');

  const response = await geminiFlash.generateContent({
    model: 'gemma-4-31b-it',
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: toJSONSchema(studyTrackDraftSchema),
      systemInstruction:
        'You create practical student study plans. Return only JSON that matches the schema.',
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...attachmentParts],
      },
    ],
  });

  const parsed = studyTrackDraftSchema.parse(parseModelJson(response.text));
  return {
    tracks: parsed.tracks.map((track) => ({
      title: track.title.trim(),
      start_date: track.start_date,
      repeat: track.repeat,
      time: track.time,
      focus_minutes: Math.round(clamp(track.focus_minutes, 1, 240)),
      break_minutes: Math.round(clamp(track.break_minutes, 0, 120)),
      total_pomodoros: Math.round(clamp(track.total_pomodoros, 1, 12)),
      notes: track.notes.trim(),
      description_as_checklist: track.description_as_checklist,
    })),
    warnings: parsed.warnings,
    reasoning: parsed.reasoning.trim(),
    skippedAttachments,
  };
}
