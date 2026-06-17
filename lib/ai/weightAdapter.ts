import { geminiFlash } from "@/lib/gemini";

export interface CompletedTaskRecord {
  task_id: number;
  task_name: string;
  task_priority: number;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  ai_priority_score: number;
  confidence_score: number | null;
  grade_weight_percent: number | null;
  completed_at: Date;
}

export interface CurrentWeights {
  w_impact: number;
  w_ease: number;
  w_urgency: number;
}

export interface WeightAdapterInput {
  completed_tasks: CompletedTaskRecord[];
  current_weights: CurrentWeights;
  total_completed_count: number;
}

export interface WeightAdapterResult {
  w_impact: number;
  w_ease: number;
  w_urgency: number;
  behavior_profile: {
    peak_productivity_hours: string | null;
    avg_estimation_accuracy: number | null;
    preferred_session_length_minutes: number | null;
    tends_to_overcommit: boolean;
    high_effort_subjects: string[];
  };
  reasoning: string;
  adjustment_magnitude: "conservative" | "moderate" | "full";
}

const SYSTEM_PROMPT = `You are a behavioral analysis assistant for a student productivity app.
Analyze the student's task completion history and suggest personalized formula weight adjustments.
Return structured JSON only. No preamble, no explanation, no text outside the JSON object.`;

const MAX_DEVIATION = {
  conservative: 0.5,
  moderate: 1.0,
  full: 2.0,
};

// This function determines the magnitude of weight adjustments allowed based on the total number of completed tasks. It categorizes the amount of data available into three levels: "conservative" for fewer than 8 tasks, "moderate" for 8 to 14 tasks, and "full" for 15 or more tasks. The magnitude influences how much the suggested weights can deviate from the current weights, ensuring that adjustments are made cautiously when limited data is available.
function getAdjustmentMagnitude(
  totalCompleted: number
): "conservative" | "moderate" | "full" {
  if (totalCompleted < 3) return "conservative";
  if (totalCompleted < 8) return "conservative";
  if (totalCompleted < 15) return "moderate";
  return "full";
}

// This function clamps the suggested weight to a reasonable range based on the current weight and adjustment magnitude. It ensures that the new weight does not deviate too far from the current weight, while also enforcing absolute minimum and maximum limits (0.5 to 8.0). The function rounds the final value to two decimal places for consistency.
function clampWeight(
  suggested: number,
  current: number,
  magnitude: "conservative" | "moderate" | "full"
): number {
  const maxDev = MAX_DEVIATION[magnitude];
  const min = Math.max(0.5, current - maxDev);
  const max = Math.min(8.0, current + maxDev);
  return Math.round(Math.min(max, Math.max(min, suggested)) * 100) / 100;
}

// This function generates personalized formula weight adjustments based on a student's task completion history. It analyzes patterns in completed tasks, such as priority handling, estimation accuracy, and deadline responsiveness, to suggest adjustments to the weights used in the priority formula. The function constructs a prompt for the Gemini AI model, which returns a structured JSON response containing the suggested weight adjustments and reasoning. The function also ensures that the suggested weights are clamped within allowed deviation ranges based on the amount of data available.
export async function adaptWeights(
  input: WeightAdapterInput
): Promise<WeightAdapterResult> {
  const magnitude = getAdjustmentMagnitude(input.total_completed_count);

  // Not enough data — return current weights unchanged
  if (input.total_completed_count < 3) {
    return {
      w_impact: input.current_weights.w_impact,
      w_ease: input.current_weights.w_ease,
      w_urgency: input.current_weights.w_urgency,
      behavior_profile: {
        peak_productivity_hours: null,
        avg_estimation_accuracy: null,
        preferred_session_length_minutes: null,
        tends_to_overcommit: false,
        high_effort_subjects: [],
      },
      reasoning:
        "Insufficient data to adapt weights. Need at least 3 completed tasks.",
      adjustment_magnitude: "conservative",
    };
  }

  const prompt = `
  Analyze this student's task completion history and suggest personalized formula weight adjustments.

  CURRENT FORMULA WEIGHTS:
  - w_impact (importance weight): ${input.current_weights.w_impact}
  - w_ease (effort weight): ${input.current_weights.w_ease}
  - w_urgency (deadline weight): ${input.current_weights.w_urgency}

  BASELINE WEIGHTS FOR REFERENCE:
  - w_impact baseline: 3.0
  - w_ease baseline: 3.0
  - w_urgency baseline: 4.0

  COMPLETED TASK HISTORY (${input.completed_tasks.length} most recent tasks):
  ${input.completed_tasks
        .map(
          (t) =>
            `- "${t.task_name}" | ` +
            `Priority: ${t.task_priority}/5.0 | ` +
            `Estimated: ${t.estimated_minutes ?? "unknown"} min | ` +
            `Actual: ${t.actual_minutes ?? "unknown"} min | ` +
            `Priority score: ${t.ai_priority_score} | ` +
            `Confidence: ${t.confidence_score ?? "unknown"}/10 | ` +
            `Grade weight: ${t.grade_weight_percent ?? "unknown"}% | ` +
            `Completed: ${t.completed_at.toDateString()}`
        )
        .join("\n")}

  TOTAL COMPLETED TASKS: ${input.total_completed_count}
  ADJUSTMENT MAGNITUDE ALLOWED: ${magnitude}
  ${magnitude === "conservative"
        ? `Maximum weight deviation from current: ±0.5`
        : magnitude === "moderate"
          ? `Maximum weight deviation from current: ±1.0`
          : `Maximum weight deviation from current: ±2.0`
      }

  ANALYSIS GUIDELINES:

  For w_impact (how much raw importance drives priority):
    Increase if: student consistently completes high-priority tasks first regardless of deadline
    Decrease if: student completes tasks in deadline order regardless of importance

  For w_ease (how much effort level drives priority):
    Increase if: student tends to complete quick tasks first, struggles with long ones
    Decrease if: student tackles hard tasks head-on without avoiding them

  For w_urgency (how much deadline pressure drives priority):
    Increase if: student frequently completes tasks close to deadline, responds well to urgency
    Decrease if: student works well ahead of deadlines, early completion pattern

  For behavior_profile:
    avg_estimation_accuracy: ratio of actual_minutes to estimated_minutes across tasks (1.0 = perfect)
    tends_to_overcommit: true if avg_estimation_accuracy consistently above 1.3
    high_effort_subjects: task names or categories where actual significantly exceeded estimated
    peak_productivity_hours: infer from completed_at timestamps if pattern is clear, else null
    preferred_session_length_minutes: median actual_minutes across completed tasks if available

  IMPORTANT: Only suggest weight changes that are clearly supported by the data.
  When in doubt, keep weights close to current values.
  All weights must be between 0.5 and 8.0.

  Return a JSON object with exactly this structure:
  {
    "w_impact": <number>,
    "w_ease": <number>,
    "w_urgency": <number>,
    "behavior_profile": {
      "peak_productivity_hours": "<string like 09:00-12:00 or null>",
      "avg_estimation_accuracy": <number or null>,
      "preferred_session_length_minutes": <number or null>,
      "tends_to_overcommit": <boolean>,
      "high_effort_subjects": ["<subject>"]
    },
    "reasoning": "<two to three sentences explaining what patterns were detected and why weights were adjusted>"
  }
  `;
  
  // Call the Gemini AI model with the constructed prompt to analyze the student's task completion history and generate suggested weight adjustments. The model is instructed to return a structured JSON response containing the new weights, behavior profile, and reasoning for the adjustments.
  const response = await geminiFlash.generateContent({
    model: "gemini-3.1-flash-lite",
    config: {
      responseMimeType: "application/json",
      systemInstruction: SYSTEM_PROMPT,
    },
    contents: prompt,
  });

  const raw = response.text;
  const parsed: WeightAdapterResult = JSON.parse(raw ?? "{}");

  // Clamp all suggested weights to allowed deviation range
  return {
    w_impact: clampWeight(
      parsed.w_impact ?? input.current_weights.w_impact,
      input.current_weights.w_impact,
      magnitude
    ),
    w_ease: clampWeight(
      parsed.w_ease ?? input.current_weights.w_ease,
      input.current_weights.w_ease,
      magnitude
    ),
    w_urgency: clampWeight(
      parsed.w_urgency ?? input.current_weights.w_urgency,
      input.current_weights.w_urgency,
      magnitude
    ),
    behavior_profile: parsed.behavior_profile ?? {
      peak_productivity_hours: null,
      avg_estimation_accuracy: null,
      preferred_session_length_minutes: null,
      tends_to_overcommit: false,
      high_effort_subjects: [],
    },
    reasoning: parsed.reasoning ?? "",
    adjustment_magnitude: magnitude,
  };
}
