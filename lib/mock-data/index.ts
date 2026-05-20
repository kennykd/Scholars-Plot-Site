/**
 * Mock data module for Scholar's Plot Site
 * Provides realistic sample data for all entities
 * Frontend-only: imported directly by page components
 */

import {
  StudySession,
  AnalyticsData,
  UserProfile,
  Notification,
  Project,
} from "@/types";

// Helper functions for relative dates
const now = new Date();
const daysFromNow = (n: number) =>
  new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const hoursFromNow = (n: number) =>
  new Date(now.getTime() + n * 60 * 60 * 1000);

// ============================================================================
// MOCK STUDY SESSIONS
// ============================================================================

export const mockStudySessions: StudySession[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    taskId: "00000000-0000-4000-8000-000000000001",
    taskTitle: "Calculus II Problem Set 5",
    duration: 25,
    breakDuration: 5,
    checklist: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        text: "Review lecture notes on integration by parts",
        completed: true,
      },
      { id: "00000000-0000-4000-8000-000000000202", text: "Complete exercises 1-5", completed: true },
      { id: "00000000-0000-4000-8000-000000000203", text: "Complete exercises 6-10", completed: false },
      {
        id: "00000000-0000-4000-8000-000000000204",
        text: "Review partial fractions method",
        completed: false,
      },
    ],
    status: "active",
    scheduledAt: hoursFromNow(1),
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    taskId: "00000000-0000-4000-8000-000000000002",
    taskTitle: "Data Structures Assignment 3",
    duration: 50,
    breakDuration: 10,
    checklist: [
      {
        id: "00000000-0000-4000-8000-000000000205",
        text: "Implement BST insert operation",
        completed: true,
      },
      {
        id: "00000000-0000-4000-8000-000000000206",
        text: "Implement BST delete operation",
        completed: false,
      },
      {
        id: "00000000-0000-4000-8000-000000000207",
        text: "Implement BST search operation",
        completed: false,
      },
      { id: "00000000-0000-4000-8000-000000000208", text: "Write unit tests", completed: false },
    ],
    status: "pending",
    scheduledAt: daysFromNow(1),
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    taskId: "00000000-0000-4000-8000-000000000003",
    taskTitle: "Physics Lab Report",
    duration: 45,
    breakDuration: 10,
    checklist: [
      { id: "00000000-0000-4000-8000-000000000209", text: "Organize experimental data", completed: false },
      {
        id: "00000000-0000-4000-8000-000000000210",
        text: "Write introduction and methodology",
        completed: false,
      },
      {
        id: "00000000-0000-4000-8000-000000000211",
        text: "Analyze results and create graphs",
        completed: false,
      },
    ],
    status: "pending",
    scheduledAt: daysFromNow(1),
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    taskId: "00000000-0000-4000-8000-000000000004",
    taskTitle: "English Composition Essay",
    duration: 60,
    breakDuration: 15,
    checklist: [
      {
        id: "00000000-0000-4000-8000-000000000212",
        text: "Research and gather sources",
        completed: false,
      },
      { id: "00000000-0000-4000-8000-000000000213", text: "Create outline", completed: false },
      { id: "00000000-0000-4000-8000-000000000214", text: "Write first draft", completed: false },
      { id: "00000000-0000-4000-8000-000000000215", text: "Revise and proofread", completed: false },
    ],
    status: "pending",
    scheduledAt: daysFromNow(2),
  },
];


// ============================================================================
// MOCK ANALYTICS
// ============================================================================

export const mockAnalytics: AnalyticsData = {
  completionStats: {
    early: 8,
    onTime: 12,
    late: 3,
    pending: 7,
  },
  timeBySubject: [
    { subject: "Data Structures", hours: 12.5 },
    { subject: "Calculus II", hours: 9.0 },
    { subject: "Physics Lab", hours: 7.5 },
    { subject: "English Composition", hours: 5.0 },
    { subject: "Web Development", hours: 14.0 },
  ],
  productivityByDay: [
    { day: "Mon", score: 85, tasksCompleted: 3 },
    { day: "Tue", score: 60, tasksCompleted: 2 },
    { day: "Wed", score: 90, tasksCompleted: 4 },
    { day: "Thu", score: 45, tasksCompleted: 1 },
    { day: "Fri", score: 75, tasksCompleted: 3 },
    { day: "Sat", score: 30, tasksCompleted: 1 },
    { day: "Sun", score: 20, tasksCompleted: 0 },
  ],
  streak: 5,
  totalFocusMinutes: 840,
  totalTasksCompleted: 23,
};

// ============================================================================
// MOCK USER
// ============================================================================

export const mockUser: UserProfile = {
  uid: "mock-user-001",
  email: "student@scholar.plot",
  displayName: "Alex Scholar",
  avatarUrl: undefined,
};

// ============================================================================
// MOCK NOTIFICATIONS
// ============================================================================

export const mockNotifications: Notification[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    taskTitle: "Calculus II Problem Set 5",
    message:
      "Your future self is already thanking you for this moment of focus.",
    deadline: daysFromNow(2),
    type: "reminder",
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    taskTitle: "Data Structures Assignment 3",
    message:
      "Every expert was once a beginner. You're building mastery right now.",
    deadline: daysFromNow(1),
    type: "deadline-approaching",
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    taskTitle: "Physics Lab Report",
    message: "The only way to do great work is to love what you do. Start now.",
    deadline: daysFromNow(1),
    type: "deadline-approaching",
  },
  {
    id: "00000000-0000-4000-8000-000000000404",
    taskTitle: "English Composition Essay",
    message: "Success is the sum of small efforts repeated day in and day out.",
    deadline: daysFromNow(5),
    type: "reminder",
  },
  {
    id: "00000000-0000-4000-8000-000000000405",
    taskTitle: "Linear Algebra Midterm Review",
    message: "You've got this! One step at a time, one problem at a time.",
    deadline: daysFromNow(7),
    type: "reminder",
  },
  {
    id: "00000000-0000-4000-8000-000000000406",
    taskTitle: "Discrete Mathematics Problem Set",
    message: "Progress over perfection. Every line of code brings you closer.",
    deadline: daysFromNow(6),
    type: "reminder",
  },
  {
    id: "00000000-0000-4000-8000-000000000407",
    taskTitle: "Operating Systems Assignment 2",
    message: "Your dedication today is the foundation of tomorrow's success.",
    deadline: daysFromNow(4),
    type: "reminder",
  },
  {
    id: "00000000-0000-4000-8000-000000000408",
    taskTitle: "Software Engineering Documentation",
    message:
      "Great things never came from comfort zones. You're doing amazing.",
    deadline: daysFromNow(8),
    type: "reminder",
  },
];

// ============================================================================
// MOCK PROJECTS
// ============================================================================

export const mockProjects: Project[] = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    name: "Capstone Collaboration",
    description: "Team coordination for the semester capstone build.",
    deadline: daysFromNow(30),
    priority: 5,
    status: "active",
    ownerId: "00000000-0000-4000-8000-000000000601",
    members: [
      {
        id: "00000000-0000-4000-8000-000000000601",
        name: "Alex Scholar",
        handle: "alex@scholar.plot",
        role: "owner",
      },
      {
        id: "00000000-0000-4000-8000-000000000602",
        name: "Jamie Rivera",
        handle: "jamie@scholar.plot",
        role: "moderator",
      },
      { id: "00000000-0000-4000-8000-000000000603", name: "Sam Lee", handle: "sam", role: "member" },
      {
        id: "00000000-0000-4000-8000-000000000604",
        name: "Taylor Park",
        handle: "taylor",
        role: "member",
      },
    ],
    tasks: [
      {
        id: "00000000-0000-4000-8000-000000000701",
        title: "Finalize project scope",
        description: "Lock requirements and success criteria for the MVP.",

        priority: 5,
        status: "Pending",
        assignedTo: "00000000-0000-4000-8000-000000000603",
        createdAt: daysFromNow(-5),
      },
      {
        id: "00000000-0000-4000-8000-000000000702",
        title: "Create kanban board UI",
        description: "Build the column layout and task cards.",

        priority: 3,
        status: "In_Progress",
        assignedTo: "00000000-0000-4000-8000-000000000602",
        createdAt: daysFromNow(-4),
      },
      {
        id: "00000000-0000-4000-8000-000000000703",
        title: "Review API integration plan",
        description: "Validate endpoints and data contracts.",

        priority: 1.5,
        status: "Completed",
        assignedTo: "00000000-0000-4000-8000-000000000601",
        createdAt: daysFromNow(-8),
      },
    ],
    createdAt: daysFromNow(-10),
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    name: "Open Study Group",
    description: "Shared tasks for the weekly study group.",
    deadline: daysFromNow(14),
    priority: 3,
    status: "active",
    ownerId: "00000000-0000-4000-8000-000000000605",
    members: [
      { id: "00000000-0000-4000-8000-000000000605", name: "Riley Chen", handle: "riley", role: "owner" },
      {
        id: "00000000-0000-4000-8000-000000000606",
        name: "Priya Patel",
        handle: "priya",
        role: "moderator",
      },
      {
        id: "00000000-0000-4000-8000-000000000607",
        name: "Jordan Blake",
        handle: "jordan",
        role: "member",
      },
    ],
    tasks: [
      {
        id: "00000000-0000-4000-8000-000000000704",
        title: "Post meeting notes",
        description: "Summarize decisions and next steps.",

        priority: 3,
        status: "Pending",
        createdAt: daysFromNow(-1),
      },
      {
        id: "00000000-0000-4000-8000-000000000705",
        title: "Collect resource links",
        description: "Gather references and practice sets.",

        priority: 1.5,
        status: "In_Progress",
        assignedTo: "00000000-0000-4000-8000-000000000607",
        createdAt: daysFromNow(-2),
      },
      {
        id: "00000000-0000-4000-8000-000000000706",
        title: "Finalize agenda",
        description: "Confirm topics for the next session.",

        priority: 5,
        status: "Completed",
        assignedTo: "00000000-0000-4000-8000-000000000606",
        createdAt: daysFromNow(-4),
      },
    ],
    createdAt: daysFromNow(-3),
  },
];

