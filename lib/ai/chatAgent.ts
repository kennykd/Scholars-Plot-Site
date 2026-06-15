import type { FunctionCall, FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import { geminiFlash } from "@/lib/gemini";
import type { ChatMessage } from "../generated/prisma/client";
import type { ChatContext } from "@/lib/services/chatService";
import {
  generateStudyTrackDraft,
  generateTaskDraft,
  type StudyTrackDraftTrack,
} from "@/lib/services/aiService";

export type ActionType =
  | "CREATE_TASK_DRAFT"
  | "CREATE_STUDY_TRACK_DRAFT";

export interface ChatAction {
  type: ActionType;
  payload: Record<string, unknown>;
}

export interface ChatAgentResult {
  text: string;
  action: ChatAction | null;
  rawResponse: string;
}

const MAX_HISTORY_MESSAGES = 20;

const createTaskDraftArgsSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(4000).optional().nullable(),
  deadline: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().min(0.5).max(5).optional().nullable(),
});

const schemaType = {
  OBJECT: "OBJECT",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
} as const;

const createStudyTrackDraftArgsSchema = z.object({
  task_id: z.coerce.number().int().positive(),
});

const createTaskDraftDeclaration: FunctionDeclaration = {
  name: "create_task_draft",
  description:
    "Create a pending task draft when the student asks Ploty to add, plan, or capture a task. The app will show the draft for confirmation before creating it.",
  parameters: {
    type: schemaType.OBJECT as never,
    properties: {
      title: {
        type: schemaType.STRING as never,
        description: "Short task title from the student's request.",
      },
      description: {
        type: schemaType.STRING as never,
        description: "Useful task notes or deliverables, if provided.",
      },
      deadline: {
        type: schemaType.STRING as never,
        description: "Future ISO 8601 deadline if the student gave one.",
      },
      priority: {
        type: schemaType.NUMBER as never,
        description: "Priority from 0.5 to 5 if it can be inferred.",
      },
    },
    required: ["title"],
  },
};

const createStudyTrackDraftDeclaration: FunctionDeclaration = {
  name: "create_study_track_draft",
  description:
    "Create a pending task-linked study track draft for an existing task. Use this only when the student wants study sessions or a study plan for a task in context.",
  parameters: {
    type: schemaType.OBJECT as never,
    properties: {
      task_id: {
        type: schemaType.INTEGER as never,
        description:
          "The task_id from the user's pending task context that should receive study sessions.",
      },
    },
    required: ["task_id"],
  },
};

const STATIC_SYSTEM_PROMPT = `
You are Ploty, a study planning assistant built into Scholars Plot for university students.
You help users manage tasks, plan task-linked study sessions, and avoid overload.

Use the user's live data to give specific, actionable advice. Do not invent tasks
or study sessions from nowhere. When the user asks to create a task or a study
plan, call the matching tool instead of writing a raw payload in text.

Tool rules:
- Use create_task_draft for task creation requests. The user will review and apply the draft.
- Use create_study_track_draft for study-session planning tied to one existing pending task.
- If the user asks for a study plan but the task is ambiguous, ask which task they mean.
- Keep normal text responses concise and direct.
`.trim();

function buildSystemPrompt(context: ChatContext): string {
  const lines: string[] = [STATIC_SYSTEM_PROMPT, "", "--- USER CONTEXT ---"];

  lines.push(
    `Current date/time: ${context.meta.current_datetime} (${context.meta.timezone})`,
    `Day of week: ${context.meta.day_of_week}`,
    "",
  );

  if (context.pending_tasks.length > 0) {
    lines.push("PENDING TASKS (sorted by priority score, highest first):");
    context.pending_tasks.forEach((task, index) => {
      const score = task.ai_priority_score !== null ? `[score: ${task.ai_priority_score}]` : "[unscored]";
      const estimate = task.estimated_minutes ? `est. ${task.estimated_minutes} min` : "no estimate";
      const weight = task.grade_weight_percent ? `grade weight: ${task.grade_weight_percent}%` : "";
      const parts = [score, `due in ${task.hours_until_deadline}h`, estimate, weight]
        .filter(Boolean)
        .join(" | ");
      lines.push(
        `${index + 1}. task_id=${task.task_id} ${task.task_name} - ${parts}`,
      );
    });
  } else {
    lines.push("PENDING TASKS: None.");
  }
  lines.push("");

  if (context.availability.length > 0) {
    lines.push("WEEKLY AVAILABILITY:");
    context.availability.forEach((slot) => {
      lines.push(
        `  ${slot.day_name}: ${slot.start_time}-${slot.end_time} (${slot.available_minutes} min)`,
      );
    });
  } else {
    lines.push("WEEKLY AVAILABILITY: Not configured.");
  }
  lines.push("");

  if (context.scheduled_sessions.length > 0) {
    lines.push("SCHEDULED SESSIONS THIS WEEK:");
    context.scheduled_sessions.forEach((session) => {
      const taskNote = session.task_name ? ` -> ${session.task_name}` : "";
      lines.push(
        `  ${session.study_session_name}${taskNote} - ${session.scheduled_at} (${session.total_minutes} min, ${session.status})`,
      );
    });
  } else {
    lines.push("SCHEDULED SESSIONS THIS WEEK: None.");
  }
  lines.push("");

  if (context.active_overload_warning) {
    lines.push(
      `ACTIVE OVERLOAD WARNING: severity=${context.active_overload_warning.severity}`,
      `  Summary: ${context.active_overload_warning.summary ?? "No details available."}`,
    );
  } else {
    lines.push("ACTIVE OVERLOAD WARNING: None.");
  }
  lines.push("");

  lines.push(
    `STUDY PREFERENCES: focus=${context.study_preferences.focus_minutes}, break=${context.study_preferences.break_minutes}, pomodoros=${context.study_preferences.total_pomodoros}, total=${context.study_preferences.total_minutes}`,
    `FORMULA WEIGHTS: impact=${context.formula_weights.w_impact}, ease=${context.formula_weights.w_ease}, urgency=${context.formula_weights.w_urgency}`,
  );

  if (context.behavior_profile) {
    const profile = context.behavior_profile;
    lines.push("BEHAVIOR PROFILE:");
    if (profile.peak_productivity_hours) lines.push(`  Peak hours: ${profile.peak_productivity_hours}`);
    if (profile.avg_estimation_accuracy) lines.push(`  Estimation: ${profile.avg_estimation_accuracy}`);
    if (profile.preferred_session_length_minutes) {
      lines.push(`  Preferred session: ${profile.preferred_session_length_minutes} min`);
    }
    if (profile.tends_to_overcommit !== null) {
      lines.push(`  Tends to overcommit: ${profile.tends_to_overcommit}`);
    }
    if (profile.high_effort_subjects.length > 0) {
      lines.push(`  High-effort subjects: ${profile.high_effort_subjects.join(", ")}`);
    }
  }

  lines.push("--- END CONTEXT ---");

  return lines.join("\n");
}

function buildGeminiHistory(messages: ChatMessage[]) {
  let recent = messages.slice(-MAX_HISTORY_MESSAGES);

  while (recent.length > 0 && recent[0].role !== "user") {
    recent = recent.slice(1);
  }

  return recent.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.text_content }],
  }));
}

function firstFunctionCall(response: { functionCalls?: FunctionCall[] }) {
  return response.functionCalls?.[0] ?? null;
}

function taskDraftText(title: string) {
  return `I drafted a task for "${title}". Review it below, then apply it if it looks right.`;
}

function studyTrackText(taskTitle: string, planCount: number) {
  return `I drafted ${planCount} study session${planCount === 1 ? "" : "s"} for "${taskTitle}". Review the plan below before applying it.`;
}

function trackToPlan(taskId: number, track: StudyTrackDraftTrack, index: number) {
  return {
    client_plan_id: `chat-plan-${taskId}-${index}`,
    title: track.title,
    start_date: track.start_date,
    repeat_enabled: track.repeat_enabled,
    repeat_every: track.repeat_every,
    repeat_unit: track.repeat_unit,
    time: track.time,
    focus_minutes: track.focus_minutes,
    break_minutes: track.break_minutes,
    total_pomodoros: track.total_pomodoros,
    notes: track.notes,
    description_as_checklist: track.description_as_checklist,
  };
}

async function handleCreateTaskDraft(args: unknown): Promise<ChatAgentResult> {
  const parsed = createTaskDraftArgsSchema.safeParse(args);
  if (!parsed.success) {
    const text = "I can draft that task, but I need at least a clear title first.";
    return { text, action: null, rawResponse: text };
  }

  const draft = await generateTaskDraft({
    title: parsed.data.title,
    description: parsed.data.description,
    deadline: parsed.data.deadline,
    priority: parsed.data.priority,
  });

  const text = taskDraftText(draft.title);
  return {
    text,
    action: {
      type: "CREATE_TASK_DRAFT",
      payload: {
        title: draft.title,
        description: draft.description,
        deadline: parsed.data.deadline?.toISOString() ?? null,
        priority: draft.priority,
        reasoning: draft.reasoning,
      },
    },
    rawResponse: text,
  };
}

async function handleCreateStudyTrackDraft(
  args: unknown,
  context: ChatContext,
): Promise<ChatAgentResult> {
  const parsed = createStudyTrackDraftArgsSchema.safeParse(args);
  if (!parsed.success) {
    const text = "I can draft study sessions, but I need to know which task to plan around.";
    return { text, action: null, rawResponse: text };
  }

  const task = context.pending_tasks.find(
    (candidate) => candidate.task_id === parsed.data.task_id,
  );

  if (!task) {
    const text = "I can draft study sessions, but I need to know which task you mean.";
    return { text, action: null, rawResponse: text };
  }

  const draft = await generateStudyTrackDraft({
    task: {
      id: task.task_id,
      title: task.task_name,
      description: task.task_description,
      deadline: new Date(task.task_deadline),
      priority: task.task_priority,
    },
    preferences: context.study_preferences,
    availability: context.availability.map((slot) => ({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
    })),
    behaviorProfile: context.behavior_profile,
    now: new Date(),
  });

  const text = studyTrackText(task.task_name, draft.tracks.length);
  return {
    text,
    action: {
      type: "CREATE_STUDY_TRACK_DRAFT",
      payload: {
        task_id: task.task_id,
        task_title: task.task_name,
        plans: draft.tracks.map((track, index) => trackToPlan(task.task_id, track, index)),
        warnings: draft.warnings,
        reasoning: draft.reasoning,
      },
    },
    rawResponse: text,
  };
}

async function handleFunctionCall(
  functionCall: FunctionCall,
  context: ChatContext,
): Promise<ChatAgentResult | null> {
  if (functionCall.name === "create_task_draft") {
    return handleCreateTaskDraft(functionCall.args);
  }

  if (functionCall.name === "create_study_track_draft") {
    return handleCreateStudyTrackDraft(functionCall.args, context);
  }

  return null;
}

export async function runChatAgent(
  userMessage: string,
  previousMessages: ChatMessage[],
  context: ChatContext,
): Promise<ChatAgentResult> {
  const response = await geminiFlash.generateContent({
    model: "gemini-3.1-flash-lite",
    config: {
      systemInstruction: buildSystemPrompt(context),
      tools: [
        {
          functionDeclarations: [
            createTaskDraftDeclaration,
            createStudyTrackDraftDeclaration,
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO",
          allowedFunctionNames: [
            "create_task_draft",
            "create_study_track_draft",
          ],
        },
      },
    },
    contents: [
      ...buildGeminiHistory(previousMessages),
      { role: "user", parts: [{ text: userMessage }] },
    ],
  });

  const functionCall = firstFunctionCall(response);
  if (functionCall) {
    const result = await handleFunctionCall(functionCall, context);
    if (result) return result;
  }

  const text = response.text?.trim() || "I could not generate a response. Please try again.";
  return {
    text,
    action: null,
    rawResponse: text,
  };
}
