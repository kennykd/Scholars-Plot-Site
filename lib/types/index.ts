/**
 * Core entity interfaces for Scholar's Plot Site
 * Frontend-only types for UI components and mock data
 */

export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Name/title of the task */
  title: string;
  /** Optional description; supports file attachments and AI processing */
  description?: string;
  /** Due date/time for the task */
  deadline: Date;
  /** Priority rating from 1-5, supports 0.5 increments (e.g., 2.5, 3.5) */
  priority: number;
  /** Current status of the task */
  status: 'todo' | 'in-progress' | 'done';
  /** Optional file names for attachments (visual only, no actual upload) */
  attachments?: string[];
  /** Reminder frequency/timing */
  reminder?: 'daily' | 'every-3-days' | 'weekly' | 'none';
  /** Timestamp when task was created */
  createdAt: Date;
  /** Timestamp when task was completed (if applicable) */
  completedAt?: Date;
}

export interface ChecklistItem {
  /** Unique identifier for the checklist item */
  id: string;
  /** Text content of the item to study */
  text: string;
  /** Whether this item has been completed */
  completed: boolean;
}

export interface StudySession {
  /** Unique identifier for the study session */
  id: string;
  /** Reference to the associated task ID */
  taskId: string;
  /** Title of the associated task */
  taskTitle: string;
  /** Duration allocated for study in minutes (default: 25 for Pomodoro) */
  duration: number;
  /** Break duration in minutes (default: 5 for Pomodoro) */
  breakDuration: number;
  /** List of items to study, automatically extracted from task description */
  checklist: ChecklistItem[];
  /** Current status of the study session */
  status: 'pending' | 'active' | 'completed';
  /** Optional scheduled date/time for the study session */
  scheduledAt?: Date;
}

export interface CalendarEvent {
  /** Unique identifier for the calendar event */
  id: string;
  /** Name/title of the event (task or study session name) */
  title: string;
  /** Type of calendar event */
  type: 'task-deadline' | 'study-session';
  /** Date of the event */
  date: Date;
  /** Optional start time in HH:mm format */
  startTime?: string;
  /** Optional end time in HH:mm format */
  endTime?: string;
  /** CSS color value for rendering the calendar block */
  color: string;
  /** Optional reference to associated task ID */
  taskId?: string;
}

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
  deadline?: Date;
  /** Type of notification */
  type: 'reminder' | 'timer-complete' | 'deadline-approaching';
}
