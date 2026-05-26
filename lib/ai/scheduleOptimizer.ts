import { geminiFlash } from "@/lib/gemini";

export interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface PendingTask {
  task_id: number;
  task_name: string;
  task_deadline: Date;
  ai_priority_score: number;
  estimated_minutes: number | null;
  confidence_score: number | null;
  project?: { project_priority: number } | null;
}

export interface StudyPreferences {
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  total_minutes: number;
}

export interface ProposedSession {
  task_id: number;
  task_name: string;
  study_session_name: string;
  scheduled_at: string; // ISO string
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  total_minutes: number;
  reasoning: string;
}

export interface ScheduleOptimizerResult {
  proposed_sessions: ProposedSession[];
  warnings: string[];
  total_scheduled_minutes: number;
  total_available_minutes: number;
}

const SYSTEM_PROMPT = `You are a study schedule optimizer for a student productivity app.
Generate a realistic, personalized weekly study schedule based on the provided data.
Return structured JSON only. No preamble, no explanation, no text outside the JSON object.`;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatAvailability(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) return "No availability provided.";

  return slots
    .map(
      (s) =>
        `${DAY_NAMES[s.day_of_week]}: ${s.start_time} - ${s.end_time}`
    )
    .join("\n");
}

function formatTasks(tasks: PendingTask[]): string {
  if (tasks.length === 0) return "No pending tasks.";

  return tasks
    .map(
      (t) =>
        `- Task ID ${t.task_id}: "${t.task_name}" | Priority score: ${t.ai_priority_score} | ` +
        `Estimated: ${t.estimated_minutes ?? "unknown"} min | ` +
        `Deadline: ${t.task_deadline.toISOString()} | ` +
        `Confidence: ${t.confidence_score ?? "unknown"}/10`
    )
    .join("\n");
}

export async function optimizeSchedule(
  availability: AvailabilitySlot[],
  tasks: PendingTask[],
  preferences: StudyPreferences,
  behaviorProfile: object | null,
  targetDate: Date
): Promise<ScheduleOptimizerResult> {
  const weekStart = new Date(targetDate);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const prompt = `
  Generate a study schedule for the week of ${weekStart.toDateString()} to ${weekEnd.toDateString()}.

  STUDENT AVAILABILITY THIS WEEK:
  ${formatAvailability(availability)}

  PENDING TASKS (ordered by priority, highest first):
  ${formatTasks(tasks)}

  STUDENT STUDY PREFERENCES (respect these unless a deadline forces otherwise):
  - Focus block: ${preferences.focus_minutes} minutes
  - Break: ${preferences.break_minutes} minutes
  - Pomodoros per session: ${preferences.total_pomodoros}
  - Total session length: ${preferences.total_minutes} minutes

  ${behaviorProfile
        ? `STUDENT BEHAVIORAL PROFILE (use to personalize scheduling):
  ${JSON.stringify(behaviorProfile, null, 2)}`
        : ""
      }

  SCHEDULING RULES (follow strictly):
  1. Only schedule sessions within the provided availability slots
  2. Never schedule two sessions at overlapping times
  3. Higher priority score tasks get scheduled earlier in the week
  4. If a task deadline falls within this week, ensure at least one session is scheduled before it
  5. If estimated_minutes for a task exceeds total_minutes preference, split across multiple sessions
  6. If an available time block is shorter than total_minutes, cap session at available time and reduce total_pomodoros proportionally (minimum 1 pomodoro)
  7. Leave at least 15 minutes gap between consecutive sessions
  8. If behavioral profile indicates peak hours, prioritize scheduling high priority tasks during those hours
  9. If total estimated work exceeds total available time, schedule highest priority tasks first and add a warning
  10. Tasks with confidence_score below 4 should be scheduled earlier to allow time for clarification

  Return a JSON object with exactly this structure:
  {
    "proposed_sessions": [
      {
        "task_id": <integer>,
        "task_name": "<string>",
        "study_session_name": "<descriptive name for this session>",
        "scheduled_at": "<ISO 8601 datetime string>",
        "focus_minutes": <integer>,
        "break_minutes": <integer>,
        "total_pomodoros": <integer>,
        "total_minutes": <integer>,
        "reasoning": "<one sentence explaining why this task was scheduled at this time>"
      }
    ],
    "warnings": ["<warning string if any>"],
    "total_scheduled_minutes": <integer>,
    "total_available_minutes": <integer>
  }

  If no sessions can be scheduled, return empty proposed_sessions array with an appropriate warning.
  `;

  const response = await geminiFlash.generateContent({
    model: "gemini-2.5-flash",
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    },
    contents: prompt,
  });

  const raw = response.text;
  const parsed: ScheduleOptimizerResult = JSON.parse(raw ?? "{}");

  // Validate proposed sessions have required fields and valid task IDs
  const validTaskIds = new Set(tasks.map((t) => t.task_id));
  const validSessions = (parsed.proposed_sessions ?? []).filter(
    (s) =>
      validTaskIds.has(s.task_id) &&
      s.scheduled_at &&
      s.total_minutes > 0
  );

  return {
    proposed_sessions: validSessions,
    warnings: parsed.warnings ?? [],
    total_scheduled_minutes: parsed.total_scheduled_minutes ?? 0,
    total_available_minutes: parsed.total_available_minutes ?? 0,
  };
}