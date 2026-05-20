import { geminiFlash } from '@/lib/gemini';

export interface TaskAnalysisInput {
  task_name: string;
  task_description: string | null;
  task_deadline: Date;
  task_priority: number;
  project_priority?: number | null;
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

export async function analyzeTask(input: TaskAnalysisInput): Promise<TaskAnalysisResult> {
  const hoursUntilDeadline = Math.round(
    (input.task_deadline.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  const prompt = `
  Analyze this student task and return the required JSON.

  Task name: ${input.task_name}
  Description: ${input.task_description ?? "No description provided"}
  Hours until deadline: ${hoursUntilDeadline}
  Student importance rating: ${input.task_priority} out of 5.0
  ${input.project_priority ? `Parent project priority: ${input.project_priority} out of 5.0` : ""}

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
    How clearly defined is this task from the name and description alone?
    1-3: Vague — no specifics, cannot start without clarification (e.g. "study", "do homework")
    4-6: Partially defined — some detail but missing scope, steps, or expected output
    7-10: Clearly defined — specific deliverables, clear scope, enough to start immediately

  grade_weight_percent:
    Extract ONLY if a specific percentage is explicitly stated.
    "worth 30% of my grade" → 30
    "final exam" → null (not an explicit percentage)
    "20% assignment" → 20
    Return null if not mentioned at all.

  estimated_minutes:
    Realistic estimate for an average university student.
    Base ranges:
    - Short reading or review: 30-60 minutes
    - Problem sets (math, science): 60-180 minutes
    - Essay or written report: 120-300 minutes
    - Coding assignment: 120-360 minutes
    - Project milestone or deliverable: 180-480 minutes
    - Exam preparation: 120-480 minutes
    Adjust upward if description is vague (hidden planning time) or scope seems large.
    Adjust downward if description is very specific and narrow.
    Minimum value: 15.
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
  const parsed: TaskAnalysisResult = JSON.parse(raw ?? "{}");

  // Clamp all outputs to valid ranges regardless of what Gemini returns
  return {
    confidence_score: Math.max(1, Math.min(10, Math.round(parsed.confidence_score))),
    grade_weight_percent: parsed.grade_weight_percent ?? null,
    estimated_minutes: Math.max(15, Math.round(parsed.estimated_minutes)),
    reasoning: parsed.reasoning,
  };
}