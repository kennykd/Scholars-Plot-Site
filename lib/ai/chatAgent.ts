import { geminiFlash } from "@/lib/gemini";
import type { ChatMessage } from "@prisma/client";
import type { ChatContext } from "@/lib/services/chatService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | "CREATE_STUDY_PLAN"
  | "CREATE_TASK"
  | "UPDATE_SCHEDULE"
  | null;

export interface ChatAction {
  type: ActionType;
  payload: Record<string, unknown> | null;
}

export interface ChatAgentResult {
  text: string;
  action: ChatAction | null;
  rawResponse: string; // full JSON string — stored in text_content for history
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 20; // 10 full exchanges

const STATIC_SYSTEM_PROMPT = `
You are a study planning assistant built into a productivity app for university students.
You help users manage tasks, plan study sessions, and avoid burnout.

You have access to the user's live data: their pending tasks, weekly availability,
scheduled sessions, formula weights, and productivity profile. Use this data to give
specific, actionable advice — not generic tips.

## What you can do

1. Answer questions about the user's workload, priorities, and schedule.
2. Suggest which tasks to focus on based on deadlines and priority scores.
3. Generate a study plan by proposing sessions (use CREATE_STUDY_PLAN action).
4. Help create a new task if the user describes something they need to do (use CREATE_TASK action).
5. Suggest schedule adjustments (use UPDATE_SCHEDULE action).

## Response format — REQUIRED

You must ALWAYS respond with this exact JSON structure and nothing else:

{
  "text": "Your conversational response here. Always write this as if speaking directly to the user.",
  "action": {
    "type": "CREATE_STUDY_PLAN" | "CREATE_TASK" | "UPDATE_SCHEDULE" | null,
    "payload": { ... } | null
  }
}

If no action is needed, set action.type to null and action.payload to null.
Never add fields outside this structure. Never respond with plain text.

## Action payload shapes

CREATE_STUDY_PLAN payload:
{
  "proposed_sessions": [
    {
      "task_id": number,
      "task_name": string,
      "study_session_name": string,
      "scheduled_at": "ISO 8601 string",
      "focus_minutes": number,
      "break_minutes": number,
      "total_pomodoros": number,
      "total_minutes": number,
      "reasoning": string
    }
  ],
  "warnings": string[],
  "total_scheduled_minutes": number
}

CREATE_TASK payload:
{
  "task_name": string,
  "task_description": string | null,
  "task_deadline": "ISO 8601 string",
  "task_priority": number (0.5–5.0 scale)
}

UPDATE_SCHEDULE payload:
{
  "suggestions": string[],
  "affected_task_ids": number[]
}

## Behaviour rules

- Always reference specific task names, deadlines, and scores from the user's data.
- If the user is overloaded (check active_overload_warning), acknowledge this before making new plans.
- Respect the user's behavior profile: if they tend to underestimate, pad session estimates.
- Use the user's availability slots — never schedule outside them.
- If data is missing (e.g., no pending tasks), say so clearly and offer what help you can.
- Keep text responses concise and direct. No motivational filler.
`.trim();

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(context: ChatContext): string {
  const lines: string[] = [STATIC_SYSTEM_PROMPT, "", "--- USER CONTEXT ---"];

  // Meta
  lines.push(
    `Current date/time: ${context.meta.current_datetime} (${context.meta.timezone})`,
    `Day of week: ${context.meta.day_of_week}`,
    ""
  );

  // Pending tasks
  if (context.pending_tasks.length > 0) {
    lines.push("PENDING TASKS (sorted by priority score, highest first):");
    context.pending_tasks.forEach((t, i) => {
      const score = t.ai_priority_score !== null ? `[score: ${t.ai_priority_score}]` : "[unscored]";
      const est = t.estimated_minutes ? `est. ${t.estimated_minutes} min` : "no estimate";
      const weight = t.grade_weight_percent ? `grade weight: ${t.grade_weight_percent}%` : "";
      const deadline = `due in ${t.hours_until_deadline}h`;
      const parts = [score, deadline, est, weight].filter(Boolean).join(" | ");
      lines.push(`${i + 1}. ${t.task_name} — ${parts}`);
    });
  } else {
    lines.push("PENDING TASKS: None.");
  }
  lines.push("");

  // Availability
  if (context.availability.length > 0) {
    lines.push("WEEKLY AVAILABILITY:");
    context.availability.forEach((a) => {
      lines.push(
        `  ${a.day_name}: ${a.start_time}–${a.end_time} (${a.available_minutes} min)`
      );
    });
  } else {
    lines.push("WEEKLY AVAILABILITY: Not configured.");
  }
  lines.push("");

  // Scheduled sessions
  if (context.scheduled_sessions.length > 0) {
    lines.push("SCHEDULED SESSIONS THIS WEEK:");
    context.scheduled_sessions.forEach((s) => {
      const taskNote = s.task_name ? ` → ${s.task_name}` : "";
      lines.push(
        `  ${s.study_session_name}${taskNote} — ${s.scheduled_at} (${s.total_minutes} min, ${s.status})`
      );
    });
  } else {
    lines.push("SCHEDULED SESSIONS THIS WEEK: None.");
  }
  lines.push("");

  // Overload warning
  if (context.active_overload_warning) {
    lines.push(
      `ACTIVE OVERLOAD WARNING: severity=${context.active_overload_warning.severity}`,
      `  Summary: ${context.active_overload_warning.summary ?? "No details available."}`
    );
  } else {
    lines.push("ACTIVE OVERLOAD WARNING: None.");
  }
  lines.push("");

  // Formula weights
  const { w_impact, w_ease, w_urgency } = context.formula_weights;
  lines.push(
    `FORMULA WEIGHTS: impact=${w_impact}, ease=${w_ease}, urgency=${w_urgency}`,
    `  (Higher urgency weight means deadlines drive priority more than difficulty or impact)`
  );
  lines.push("");

  // Behavior profile — only if it exists
  if (context.behavior_profile) {
    const p = context.behavior_profile;
    lines.push("BEHAVIOR PROFILE:");
    if (p.peak_productivity_hours) lines.push(`  Peak hours: ${p.peak_productivity_hours}`);
    if (p.avg_estimation_accuracy) lines.push(`  Estimation: ${p.avg_estimation_accuracy}`);
    if (p.preferred_session_length_minutes)
      lines.push(`  Preferred session: ${p.preferred_session_length_minutes} min`);
    if (p.tends_to_overcommit !== null)
      lines.push(`  Tends to overcommit: ${p.tends_to_overcommit}`);
    if (p.high_effort_subjects.length > 0)
      lines.push(`  High-effort subjects: ${p.high_effort_subjects.join(", ")}`);
  }

  lines.push("--- END CONTEXT ---");

  return lines.join("\n");
}

// ─── History Reconstruction ───────────────────────────────────────────────────

function buildGeminiHistory(messages: ChatMessage[]) {
  // Take the most recent N messages
  let recent = messages.slice(-MAX_HISTORY_MESSAGES);

  // History must start with a user message — drop leading assistant messages
  while (recent.length > 0 && recent[0].role !== "user") {
    recent = recent.slice(1);
  }

  return recent.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text_content }],
  }));
}

// ─── Response Parser ──────────────────────────────────────────────────────────

function parseEnvelope(raw: string): { text: string; action: ChatAction | null } {
  try {
    // Strip any accidental markdown fences Gemini might add despite responseMimeType
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const text =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : "I wasn't able to generate a response. Please try again.";

    const actionType = parsed.action?.type ?? null;
    const validTypes: ActionType[] = ["CREATE_STUDY_PLAN", "CREATE_TASK", "UPDATE_SCHEDULE"];
    const action: ChatAction | null =
      validTypes.includes(actionType)
        ? { type: actionType, payload: parsed.action?.payload ?? null }
        : null;

    return { text, action };
  } catch {
    // Malformed JSON — return raw text as a plain response, no action
    return {
      text: raw.trim() || "Something went wrong. Please try again.",
      action: null,
    };
  }
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function runChatAgent(
  userMessage: string,
  previousMessages: ChatMessage[],
  context: ChatContext
): Promise<ChatAgentResult> {
  const systemInstruction = buildSystemPrompt(context);
  const history = buildGeminiHistory(previousMessages);

  const response = await geminiFlash.generateContent({
    model: "gemini-2.5-flash",
    config: {
      responseMimeType: "application/json",
      systemInstruction,
    },
    contents: [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ],
  });

  const raw = response.text ?? "";

  const { text, action } = parseEnvelope(raw);

  return {
    text,
    action,
    rawResponse: raw, // stored in text_content — Gemini sees this in future turns
  };
}