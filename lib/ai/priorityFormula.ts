// This module defines the priority formula used to calculate a priority score for tasks based on various factors such as impact, ease, and urgency. The formula takes into account user-provided weights for each factor, as well as any grade weight percentage that may apply to the task. The resulting priority score is normalized to a range of 0-100 for consistent comparison across tasks.
export interface FormulaInputs {
  task_priority: number;           // 0.5-5.0
  confidence_score: number;        // 1-10
  estimated_minutes: number;
  task_deadline: Date;
  grade_weight_percent: number | null;
  w_impact?: number;               // per-user weights, defaults to baseline
  w_ease?: number;
  w_urgency?: number;
}

// This function normalizes the impact score of a task to a range of 1-10.
function normalizeImpact(task_priority: number): number {
  return task_priority * 2; // 0.5-5.0 → 1-10
}

// This function applies a grade weight multiplier to the impact score of a task. If a grade weight percentage is provided, it increases the impact score based on the percentage, with a maximum multiplier of 2x for a 100% grade weight. If no grade weight is provided, it simply returns the original impact score without modification.
function applyGradeWeight(impact: number, grade_weight_percent: number | null): number {
  if (!grade_weight_percent) return impact;
  const multiplier = 1 + Math.min(1, grade_weight_percent / 50);
  return Math.min(10, impact * multiplier);
}

// This function calculates the ease score for a task based on its estimated time to complete. Tasks that are very short (15 minutes or less) are considered easiest with a score of 10, while tasks that are very long (480 minutes or more) are considered hardest with a score of 1. For tasks in between, the ease score is calculated using a logarithmic scale to provide a smooth gradient of scores based on the estimated time.
function calculateEase(estimated_minutes: number): number {
  if (estimated_minutes <= 15) return 10;
  if (estimated_minutes >= 480) return 1;
  return Math.max(
    1,
    Math.min(
      10,
      10 - (9 * Math.log(estimated_minutes / 15) / Math.log(480 / 15))
    )
  );
}

// This function calculates the urgency score for a task based on its deadline and estimated time to complete. It considers how much time is remaining until the deadline and how that compares to the estimated time required to complete the task. The urgency score is higher for tasks that are closer to their deadlines or have less buffer time, and it is normalized to a range of 1-10.
function calculateUrgency(deadline: Date, estimated_minutes: number): number {
  const hoursRemaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const estimatedHours = estimated_minutes / 60;
  const buffer = hoursRemaining - estimatedHours;

  if (buffer <= 0) return 10; // overdue or no breathing room
  return Math.max(1, Math.min(10, 10 * Math.exp(-buffer / 48)));
}

// This function calculates the priority score for a task based on its impact, ease, and urgency. It applies user-defined weights to each factor and normalizes the final score to a range of 0-100. The function also includes safeguards to ensure that the returned score is within the valid range, and it rounds the result to the nearest whole number for easier interpretation.
export function calculatePriorityScore(inputs: FormulaInputs): number {
  const impact = applyGradeWeight(
    normalizeImpact(inputs.task_priority),
    inputs.grade_weight_percent
  );
  const ease = calculateEase(inputs.estimated_minutes);
  const urgency = calculateUrgency(inputs.task_deadline, inputs.estimated_minutes);

  // Use per-user weights if provided, otherwise use baseline
  const W_IMPACT = inputs.w_impact ?? 3.0;
  const W_EASE = inputs.w_ease ?? 3.0;
  const W_URGENCY = inputs.w_urgency ?? 4.0;

  const score = impact * W_IMPACT + ease * W_EASE + urgency * W_URGENCY;
  return Math.round(Math.max(0, Math.min(100, score)));
}