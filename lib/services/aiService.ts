import { analyzeTask, TaskAnalysisInput } from "@/lib/ai/taskAnalyzer";
import { calculatePriorityScore } from "@/lib/ai/priorityFormula";
import { optimizeSchedule } from "@/lib/ai/scheduleOptimizer";
import {
  updateTaskAIFields,
  getTaskWithProject,
  getUserFormulaWeights,
  getTaskAttachments,
} from "@/lib/services/taskService";
import {
  getUserAvailability,
  getUserPendingTasks,
  getUserStudyPreferences,
  getUserBehaviorProfile,
} from "@/lib/services/scheduleService";

export async function runTaskAnalysis(
  task_id: number,
  user_id: string
): Promise<void> {
  const task = await getTaskWithProject(task_id);
  if (!task) throw new Error(`Task ${task_id} not found`);

  const [userWeights, attachments] = await Promise.all([
    getUserFormulaWeights(user_id),
    getTaskAttachments(task_id),
  ]);

  const analysisInput: TaskAnalysisInput = {
    task_name: task.task_name,
    task_description: task.task_description,
    task_deadline: task.task_deadline,
    task_priority: Number(task.task_priority),
    project_priority: task.project?.project_priority
      ? Number(task.project.project_priority)
      : null,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  const analysis = await analyzeTask(analysisInput);

  const ai_priority_score = calculatePriorityScore({
    task_priority: Number(task.task_priority),
    confidence_score: analysis.confidence_score,
    estimated_minutes: analysis.estimated_minutes,
    task_deadline: task.task_deadline,
    grade_weight_percent: analysis.grade_weight_percent,
    w_impact: userWeights ? Number(userWeights.w_impact) : undefined,
    w_ease: userWeights ? Number(userWeights.w_ease) : undefined,
    w_urgency: userWeights ? Number(userWeights.w_urgency) : undefined,
  });

  await updateTaskAIFields(task_id, {
    confidence_score: analysis.confidence_score,
    grade_weight_percent: analysis.grade_weight_percent,
    estimated_minutes: analysis.estimated_minutes,
    ai_priority_score,
  });
}

export async function runScheduleOptimizer(
  user_id: string,
  targetDate: Date
) {
  const [availability, tasks, preferences, behaviorProfile] = await Promise.all([
    getUserAvailability(user_id),
    getUserPendingTasks(user_id),
    getUserStudyPreferences(user_id),
    getUserBehaviorProfile(user_id),
  ]);

  if (availability.length === 0) {
    return {
      proposed_sessions: [],
      warnings: ["No availability set. Please configure your weekly availability before generating a schedule."],
      total_scheduled_minutes: 0,
      total_available_minutes: 0,
    };
  }

  if (tasks.length === 0) {
    return {
      proposed_sessions: [],
      warnings: ["No pending tasks with priority scores found."],
      total_scheduled_minutes: 0,
      total_available_minutes: 0,
    };
  }

  return optimizeSchedule(
    availability,
    tasks.map((t) => ({
      task_id: t.task_id,
      task_name: t.task_name,
      task_deadline: t.task_deadline,
      ai_priority_score: t.ai_priority_score!,
      estimated_minutes: t.estimated_minutes,
      confidence_score: t.confidence_score,
      project: t.project
        ? { project_priority: Number(t.project.project_priority) }
        : null,
    })),
    preferences,
    behaviorProfile as object | null,
    targetDate
  );
}