import { FunctionCallingConfigMode, type FunctionCall, type FunctionDeclaration } from "@google/genai";
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

// This constant defines the maximum number of recent messages to include in the Gemini AI model's context. It ensures that the model has enough information to generate relevant responses while avoiding excessive context that could lead to performance issues or irrelevant outputs.
const MAX_HISTORY_MESSAGES = 20;

const createTaskDraftArgsSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(4000).optional().nullable(),
  deadline: z.coerce.date(),
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

// Function declaration for creating a task draft
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
    required: ["title", "deadline"],
  },
};

// Function declaration for creating a study track draft
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

// This constant defines the function calling configuration for the Gemini AI model. It specifies that the model should use the "create_task_draft" and "create_study_track_draft" functions when appropriate, and that it should automatically decide when to call these functions based on the user's input. The configuration ensures that the model can generate structured outputs for task creation and study planning without requiring explicit instructions from the user.
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

// This function builds a detailed system prompt for the Gemini AI model by incorporating the user's current context, including pending tasks, availability, scheduled sessions, active overload warnings, study preferences, formula weights, and behavior profile. The prompt is structured to provide the model with all relevant information needed to generate accurate and context-aware responses. It includes clear sections for each aspect of the user's context and formats the information in a human-readable way.
function buildSystemPrompt(context: ChatContext): string {
  const lines: string[] = [STATIC_SYSTEM_PROMPT, "", "--- USER CONTEXT ---"];

  lines.push(
    `Current date/time: ${context.meta.current_datetime} (${context.meta.timezone})`,
    `Day of week: ${context.meta.day_of_week}`,
    "",
  );

  // Format the pending tasks section, including task ID, name, priority score, estimated time, and grade weight percentage. If there are no pending tasks, indicate that as well.
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

  // Format the weekly availability section, including day name, start and end times, and total available minutes. If no availability is configured, indicate that as well.
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

  // Format the scheduled sessions section, including session name, scheduled time, total minutes, and linked task name if available. If there are no scheduled sessions, indicate that as well.
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

  // Format the active overload warning section, including severity and summary if present. If there is no active overload warning, indicate that as well.
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

  // Format the behavior profile section, including peak productivity hours, average estimation accuracy, preferred session length, tendency to overcommit, and high-effort subjects if available. If there is no behavior profile, this section will be omitted.
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

// This function builds the message history for the Gemini AI model by selecting the most recent messages up to a defined limit. It ensures that the history starts with a user message, filtering out any initial model messages. Each message is formatted into a structure that includes the role (user or model) and the text content, which is necessary for the model to understand the conversation context and generate appropriate responses.
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

// This function handles the creation of a task draft based on user input. It validates the input against a predefined schema, and if valid, it calls the AI service to generate a task draft. The function then constructs a response that includes the draft details and a message for the user to review. If the input is invalid, it returns an error message indicating that more information is needed.
async function handleCreateTaskDraft(args: unknown): Promise<ChatAgentResult> {
  const parsed = createTaskDraftArgsSchema.safeParse(args);
  if (!parsed.success) {
    const text = "I can draft that task, but I need a clear title and deadline first.";
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
        deadline: parsed.data.deadline.toISOString(),
        priority: draft.priority,
        reasoning: draft.reasoning,
      },
    },
    rawResponse: text,
  };
}

// This function handles the creation of a study track draft for an existing task based on user input and the current context. It validates the input to ensure that a valid task ID is provided, checks if the task exists in the user's pending tasks, and then calls the AI service to generate a study track draft. The function constructs a response that includes the draft details and a message for the user to review. If the input is invalid or the task is not found, it returns an appropriate error message.
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

// This function handles the processing of a function call from the Gemini AI model. It checks the name of the function call and delegates to the appropriate handler for creating a task draft or a study track draft. If the function call is recognized and successfully handled, it returns the result; otherwise, it returns null, indicating that no action was taken.
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

// This function runs the chat agent, which processes user messages in the context of a conversation. It sends the user's message and the conversation history to the Gemini AI model, along with the current context. The model may return a function call to create a task draft or a study track draft, which is then handled appropriately. If no function call is returned, the function returns a text response generated by the model.
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
          mode: FunctionCallingConfigMode.AUTO,
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
