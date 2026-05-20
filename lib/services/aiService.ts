import { analyzeTask, TaskAnalysisInput } from '@/lib/ai/taskAnalyzer';
import { calculatePriorityScore } from '@/lib/ai/priorityFormula';
import { getTaskWithProject, getUserFormulaWeights, updateTaskAIFields } from '@/lib/services/taskService';

export async function runTaskAnalysis(task_id: number, user_id: string): Promise<void> {
  const task = await getTaskWithProject(task_id);
  if (!task) throw new Error(`Task ${task_id} not found`);

  const parsedUserId = Number(user_id);
  const userWeights = Number.isFinite(parsedUserId) ? await getUserFormulaWeights(parsedUserId) : null;

  const analysisInput: TaskAnalysisInput = {
    task_name: task.task_name,
    task_description: task.task_description,
    task_deadline: task.task_deadline,
    task_priority: Number(task.task_priority),
    project_priority: task.project?.project_priority ? Number(task.project.project_priority) : null,
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