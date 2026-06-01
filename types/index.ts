export type TaskStatus = "Pending" | "In_Progress" | "Completed";
export type ProjectTaskStatus = "not-done" | "pending" | "done";
export type ReminderIntervalType = "minutes" | "hours" | "days" | "weeks" | "months";
export type StudyReminderValueUnit = "minutes" | "hours";
export type ReminderFrequency =
  | "none"
  | "daily"
  | "every-3-days"
  | "weekly"
  | "biweekly"
  | "monthly";
export type StudyReminderOffset = {
  unit: StudyReminderValueUnit;
  value: number;
  atStart?: boolean;
};
export type Phase = "idle" | "focus" | "break";

export interface Attachment {
  id: number;
  taskId: number | null;
  fileName: string;
  fileKey: string;
  fileType: string;
  url: string;
  uploadedAt: string;
}

export interface Task {
  id: number;
  projectId: number | null;
  title: string;
  description: string | null;
  deadline: string;
  priority: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  attachments?: Attachment[];
}

export type StudySession = {
  id: string;
  title: string;
  notes: string;
  attachments: string[];
  scheduledAt: string;
  focusMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  sessionStatus: "idle" | "running" | "paused" | "completed";
  createdAt: string;
  reminderEnabled?: boolean;
  reminderOffsets?: number[];
  isTimerOnly?: boolean;
  current_time?: number;
  paused_seconds?: number;
  paused_phase?: Phase;
  paused_total_seconds_remaining?: number;
};



export interface AnalyticsData {
  /** Task completion metrics categorized by timing */
  completionStats: {
    /** Number of tasks completed before deadline */
    early: number;
    /** Number of tasks completed on time */
    onTime: number;
    /** Number of tasks completed after deadline */
    late: number;
    /** Number of tasks still pending */
    pending: number;
  };
  /** Time allocation breakdown by subject/category */
  timeBySubject: {
    /** Subject or category name */
    subject: string;
    /** Hours spent on this subject */
    hours: number;
  }[];
  /** Productivity metrics by day of week */
  productivityByDay: {
    /** Day of the week (e.g., "Monday", "Tuesday") */
    day: string;
    /** Productivity score for the day */
    score: number;
    /** Number of tasks completed on that day */
    tasksCompleted: number;
  }[];
  /** Number of consecutive productive days */
  streak: number;
  /** Total Pomodoro minutes completed */
  totalFocusMinutes: number;
  /** Total number of tasks completed */
  totalTasksCompleted: number;
}

export interface UserProfile {
  /** Firebase UID for the user */
  uid: string;
  /** User's email address */
  email: string;
  /** Optional display name for the user */
  displayName?: string;
  /** Optional URL to user's avatar image */
  avatarUrl?: string;
}

export interface Notification {
  /** Unique identifier for the notification */
  id: string;
  /** Title of the associated task */
  taskTitle: string;
  /** Motivational or convincing message to display */
  message: string;
  /** Optional deadline associated with the notification */
  deadline?: string;
  /** Type of notification */
  type: "reminder" | "timer-complete" | "deadline-approaching";
}

export type ProjectRole = "owner" | "moderator" | "member";

export interface ProjectMember {
  /** Unique identifier for the member */
  id: string;
  /** Display name for the member */
  name: string;
  /** Optional email or username */
  handle?: string;
  /** Role within the project */
  role: ProjectRole;
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  attachments?: string[];
  reminder?: ReminderFrequency;
  priority: number;
  status: ProjectTaskStatus;
  assignedTo?: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  deadline: Date;
  priority: number;
  status: "active" | "completed" | "archived";
  ownerId: string;
  members: ProjectMember[];
  tasks: ProjectTask[];
  createdAt: Date;
}

/** Type for the json format expected in AI responses */
import type { AIResponseData } from '../lib/validation/ai';

export interface AIRequest {
  /** User's text message/prompt */
  message: string;
  /** Optional file names for attachments */
  attachments?: string[];
}

export interface AIResponse {
  /** Unique identifier for the AI response */
  id: string;
  /** AI's language response for the user's input */
  chatResponse: string;
  /** Structured JSON result from AI processing */
  jsonFormat?: AIResponseData['jsonFormat'];
  /** Timestamp when the response was created */
  createdAt: Date;
}
