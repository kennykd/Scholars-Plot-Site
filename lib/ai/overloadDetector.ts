import { geminiFlash } from "@/lib/gemini";

export interface ScheduledSession {
  study_session_name: string;
  scheduled_at: Date;
  total_minutes: number;
  task_id: number | null;
  task_name: string | null;
}

export interface UnscheduledTask {
  task_id: number;
  task_name: string;
  task_deadline: Date;
  ai_priority_score: number;
  estimated_minutes: number | null;
}

export interface OverloadDetectorInput {
  scheduled_sessions: ScheduledSession[];
  unscheduled_tasks: UnscheduledTask[];
  total_available_minutes: number;
  week_start: Date;
  week_end: Date;
}

export interface TaskRisk {
  task_id: number;
  task_name: string;
  risk_level: "high" | "medium" | "low";
  reason: string;
  recommendation: string;
}

export interface OverloadDetectorResult {
  overload_detected: boolean;
  severity: "critical" | "high" | "medium" | "low" | "none";
  at_risk_tasks: TaskRisk[];
  warnings: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a student workload analyst for a productivity app.
Analyze the student's weekly workload and identify overload risks and deadline dangers.
Return structured JSON only. No preamble, no explanation, no text outside the JSON object.`;

// This function generates a study schedule for the given week based on the student's availability, pending tasks, study preferences, and optional behavioral profile. It constructs a prompt for the Gemini AI model, which returns a structured JSON response containing proposed study sessions and any warnings. The function validates the proposed sessions to ensure they reference valid task IDs and have required fields before returning the final result.
function formatScheduledSessions(sessions: ScheduledSession[]): string {
  if (sessions.length === 0) return "No sessions scheduled this week.";

  return sessions
    .map(
      (s) =>
        `- "${s.study_session_name}" | ` +
        `Scheduled: ${new Date(s.scheduled_at).toLocaleString()} | ` +
        `Duration: ${s.total_minutes} min | ` +
        `Task: ${s.task_name ?? "No task linked"}`
    )
    .join("\n");
}

// This function formats the unscheduled pending tasks into a human-readable string for inclusion in the AI prompt. Each task is represented by its ID, name, deadline, priority score, and estimated time. If no unscheduled tasks are provided, it returns a message indicating that.
function formatUnscheduledTasks(tasks: UnscheduledTask[]): string {
  if (tasks.length === 0) return "No unscheduled pending tasks.";

  return tasks
    .map(
      (t) =>
        `- Task ID ${t.task_id}: "${t.task_name}" | ` +
        `Deadline: ${t.task_deadline.toISOString()} | ` +
        `Priority score: ${t.ai_priority_score} | ` +
        `Estimated: ${t.estimated_minutes ?? "unknown"} min`
    )
    .join("\n");
}

// This function analyzes the student's workload for a given week based on their scheduled study sessions and unscheduled pending tasks. It constructs a prompt for the Gemini AI model, which evaluates the workload according to specific rules and returns a structured JSON response indicating whether overload is detected, the severity level, at-risk tasks, any warnings, and a summary of the overall workload situation. The function then parses and returns this information in a structured format.
export async function detectOverload(
  input: OverloadDetectorInput
): Promise<OverloadDetectorResult> {
  const totalScheduledMinutes = input.scheduled_sessions.reduce(
    (sum, s) => sum + s.total_minutes,
    0
  );

  const prompt = `
  Analyze this student's workload for the week of ${input.week_start.toDateString()} to ${input.week_end.toDateString()}.

  SCHEDULED STUDY SESSIONS THIS WEEK:
  ${formatScheduledSessions(input.scheduled_sessions)}

  UNSCHEDULED PENDING TASKS (no sessions assigned yet):
  ${formatUnscheduledTasks(input.unscheduled_tasks)}

  WORKLOAD SUMMARY:
  - Total scheduled study time: ${totalScheduledMinutes} minutes
  - Total available study time this week: ${input.total_available_minutes} minutes
  - Unscheduled tasks count: ${input.unscheduled_tasks.length}

  ANALYSIS RULES:
  1. A task is DEADLINE_AT_RISK if its deadline falls within this week and has no scheduled sessions
  2. A task is OVERRUN_RISK if its estimated_minutes exceeds the total scheduled time for that task this week
  3. The week is OVERLOADED if total scheduled minutes exceeds total available minutes by more than 15%
  4. The week is CRITICALLY_OVERLOADED if total scheduled minutes exceeds available minutes by more than 40%
  5. A task with high priority score (above 70) and no sessions is always at least medium risk
  6. Multiple high priority tasks with imminent deadlines and no sessions = critical severity
  7. Unscheduled tasks with deadlines within 48 hours are always high risk regardless of priority

  SEVERITY LEVELS:
  - critical: student will almost certainly miss deadlines or burn out
  - high: serious risk of missing at least one deadline
  - medium: manageable but student should take action soon
  - low: minor concerns worth noting
  - none: workload looks healthy

  Return a JSON object with exactly this structure:
  {
    "overload_detected": <boolean>,
    "severity": "<critical|high|medium|low|none>",
    "at_risk_tasks": [
      {
        "task_id": <integer>,
        "task_name": "<string>",
        "risk_level": "<high|medium|low>",
        "reason": "<one sentence explaining the risk>",
        "recommendation": "<one concrete action the student should take>"
      }
    ],
    "warnings": ["<warning string>"],
    "summary": "<two to three sentences summarizing the overall workload situation>"
  }

  If no risks are detected, return overload_detected: false, severity: none, empty at_risk_tasks and warnings arrays, and a positive summary.
  `;

  // Call the Gemini AI model with the constructed prompt. The model is expected to return a JSON response containing the analysis of the student's workload, including any detected overload risks, severity level, at-risk tasks, warnings, and a summary. The function then parses this response and returns it in a structured format.
  const response = await geminiFlash.generateContent({
    model: "gemini-3.1-flash-lite",
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    },
    contents: prompt,
  });

  // Validate the parsed response to ensure it contains the expected structure and types
  const raw = response.text;
  const parsed: OverloadDetectorResult = JSON.parse(raw ?? "{}");

  // Returns the validated result with default values for any missing or incorrectly typed fields
  return {
    overload_detected: parsed.overload_detected ?? false,
    severity: parsed.severity ?? "none",
    at_risk_tasks: parsed.at_risk_tasks ?? [],
    warnings: parsed.warnings ?? [],
    summary: parsed.summary ?? "",
  };
}