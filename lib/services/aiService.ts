import { analyzeTask, TaskAnalysisInput } from "@/lib/ai/taskAnalyzer";
import { calculatePriorityScore } from "@/lib/ai/priorityFormula";
import { optimizeSchedule } from "@/lib/ai/scheduleOptimizer";
import { detectOverload } from "@/lib/ai/overloadDetector";
import prisma from "@/lib/prisma";
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
import {
  getScheduledSessionsForWeek,
  getUnscheduledTasksForWeek,
  getTotalAvailableMinutes,
  saveOverloadWarning,
} from "@/lib/services/overloadService";
import { adaptWeights } from "@/lib/ai/weightAdapter";
import {
  getCompletedTasksForUser,
  getTotalCompletedCount,
  getCurrentWeights,
  saveAdaptedWeights,
  getAllActiveUserIds,
} from "@/lib/services/weightService";


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
  const weekStart = new Date(targetDate);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [availability, tasks, preferences, behaviorProfile] =
    await Promise.all([
      getUserAvailability(user_id),
      getUserPendingTasks(user_id),
      getUserStudyPreferences(user_id),
      getUserBehaviorProfile(user_id),
    ]);

  if (availability.length === 0) {
    return {
      proposed_sessions: [],
      warnings: [
        "No availability set. Please configure your weekly availability before generating a schedule.",
      ],
      total_scheduled_minutes: 0,
      total_available_minutes: 0,
      overload: null,
    };
  }

  if (tasks.length === 0) {
    return {
      proposed_sessions: [],
      warnings: ["No pending tasks with priority scores found."],
      total_scheduled_minutes: 0,
      total_available_minutes: 0,
      overload: null,
    };
  }

  const scheduleResult = await optimizeSchedule(
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

  // Run overload detection after schedule is generated
  // Uses the proposed sessions as the scheduled context
  const overloadResult = await runOverloadDetector(
    user_id,
    weekStart,
    weekEnd,
    scheduleResult.total_available_minutes
  );

  return {
    ...scheduleResult,
    overload: overloadResult,
  };
}

export async function runOverloadDetector(
  user_id: string,
  weekStart: Date,
  weekEnd: Date,
  totalAvailableMinutes?: number
) {
  const [scheduledSessions, unscheduledTasks, availableMinutes] =
    await Promise.all([
      getScheduledSessionsForWeek(user_id, weekStart, weekEnd),
      getUnscheduledTasksForWeek(user_id, weekEnd),
      totalAvailableMinutes !== undefined
        ? Promise.resolve(totalAvailableMinutes)
        : getTotalAvailableMinutes(user_id, weekStart),
    ]);

  const result = await detectOverload({
    scheduled_sessions: scheduledSessions,
    unscheduled_tasks: unscheduledTasks,
    total_available_minutes: availableMinutes,
    week_start: weekStart,
    week_end: weekEnd,
  });

  // Always persist the detection result regardless of severity
  await saveOverloadWarning(user_id, weekStart, result);

  return result;
}

export async function runWeightAdapter(user_id: string) {
  const [completedTasks, totalCompleted, currentWeights] = await Promise.all([
    getCompletedTasksForUser(user_id),
    getTotalCompletedCount(user_id),
    getCurrentWeights(user_id),
  ]);

  const result = await adaptWeights({
    completed_tasks: completedTasks,
    current_weights: currentWeights,
    total_completed_count: totalCompleted,
  });

  await saveAdaptedWeights(user_id, result);

  // Update behavior profile on user record
  await prisma.user.update({
    where: { user_id },
    data: {
      ai_behavior_profile: result.behavior_profile,
      ai_profile_updated_at: new Date(),
    },
  });

  return result;
}

export async function runWeightAdapterForAllUsers() {
  const userIds = await getAllActiveUserIds();

  const results = await Promise.allSettled(
    userIds.map((user_id) => runWeightAdapter(user_id))
  );

  const summary = {
    total: userIds.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    errors: results
      .map((r, i) =>
        r.status === "rejected"
          ? { user_id: userIds[i], error: r.reason?.message }
          : null
      )
      .filter(Boolean),
  };

  return summary;
}
