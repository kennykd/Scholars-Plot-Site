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

function normalizeImpact(task_priority: number): number {
  return task_priority * 2; // 0.5-5.0 → 1-10
}

function applyGradeWeight(impact: number, grade_weight_percent: number | null): number {
  if (!grade_weight_percent) return impact;
  const multiplier = 1 + Math.min(1, grade_weight_percent / 50);
  return Math.min(10, impact * multiplier);
}

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

function calculateUrgency(deadline: Date, estimated_minutes: number): number {
  const hoursRemaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const estimatedHours = estimated_minutes / 60;
  const buffer = hoursRemaining - estimatedHours;

  if (buffer <= 0) return 10; // overdue or no breathing room
  return Math.max(1, Math.min(10, 10 * Math.exp(-buffer / 48)));
}

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