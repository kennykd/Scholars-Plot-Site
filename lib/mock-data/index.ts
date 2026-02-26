/**
 * Mock data module for Scholar's Plot Site
 * Provides realistic sample data for all entities
 * Frontend-only: imported directly by page components
 */

import {
  Task,
  StudySession,
  CalendarEvent,
  AnalyticsData,
  UserProfile,
  Notification,
} from '@/lib/types';

// Helper functions for relative dates
const now = new Date();
const daysFromNow = (n: number) =>
  new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const hoursFromNow = (n: number) =>
  new Date(now.getTime() + n * 60 * 60 * 1000);

// ============================================================================
// MOCK TASKS
// ============================================================================

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    title: 'Calculus II Problem Set 5',
    description:
      'Complete exercises 1-15 from Chapter 5. Focus on integration by parts and partial fractions.',
    deadline: daysFromNow(2),
    priority: 4.5,
    status: 'in-progress',
    attachments: ['problem-set-5.pdf', 'solutions-guide.pdf'],
    reminder: 'daily',
    createdAt: daysFromNow(-7),
  },
  {
    id: 'task-002',
    title: 'Data Structures Assignment 3',
    description:
      'Implement binary search tree with insert, delete, and search operations. Include unit tests.',
    deadline: daysFromNow(3),
    priority: 5,
    status: 'in-progress',
    attachments: ['assignment-spec.pdf'],
    reminder: 'every-3-days',
    createdAt: daysFromNow(-5),
  },
  {
    id: 'task-003',
    title: 'Physics Lab Report',
    description: 'Write lab report for experiment on simple harmonic motion.',
    deadline: daysFromNow(1),
    priority: 4,
    status: 'todo',
    reminder: 'weekly',
    createdAt: daysFromNow(-10),
  },
  {
    id: 'task-004',
    title: 'English Composition Essay',
    description:
      'Write 2000-word essay on "The Role of Technology in Modern Society". Include at least 5 academic sources.',
    deadline: daysFromNow(5),
    priority: 3.5,
    status: 'todo',
    reminder: 'none',
    createdAt: daysFromNow(-3),
  },
  {
    id: 'task-005',
    title: 'Web Development Project Milestone 1',
    description: 'Complete frontend design and setup. Deploy to staging environment.',
    deadline: daysFromNow(-1),
    priority: 5,
    status: 'done',
    completedAt: daysFromNow(-2),
    reminder: 'daily',
    createdAt: daysFromNow(-14),
  },
  {
    id: 'task-006',
    title: 'Linear Algebra Midterm Review',
    description: 'Review chapters 1-4. Practice matrix operations and eigenvalues.',
    deadline: daysFromNow(7),
    priority: 3,
    status: 'todo',
    reminder: 'weekly',
    createdAt: daysFromNow(-4),
  },
  {
    id: 'task-007',
    title: 'Database Systems Project',
    description: 'Design and implement relational database schema for e-commerce platform.',
    deadline: daysFromNow(-3),
    priority: 4.5,
    status: 'done',
    completedAt: daysFromNow(-1),
    reminder: 'every-3-days',
    createdAt: daysFromNow(-21),
  },
  {
    id: 'task-008',
    title: 'Operating Systems Assignment 2',
    description: 'Implement process scheduling algorithms: FCFS, SJF, and Round Robin.',
    deadline: daysFromNow(4),
    priority: 2.5,
    status: 'done',
    completedAt: daysFromNow(-5),
    reminder: 'none',
    createdAt: daysFromNow(-12),
  },
  {
    id: 'task-009',
    title: 'Discrete Mathematics Problem Set',
    description: 'Complete graph theory and combinatorics problems.',
    deadline: daysFromNow(6),
    priority: 2,
    status: 'todo',
    reminder: 'weekly',
    createdAt: daysFromNow(-2),
  },
  {
    id: 'task-010',
    title: 'Software Engineering Documentation',
    description: 'Write system design document and API specifications.',
    deadline: daysFromNow(8),
    priority: 1,
    status: 'todo',
    reminder: 'none',
    createdAt: daysFromNow(-1),
  },
];

// ============================================================================
// MOCK STUDY SESSIONS
// ============================================================================

export const mockStudySessions: StudySession[] = [
  {
    id: 'session-001',
    taskId: 'task-001',
    taskTitle: 'Calculus II Problem Set 5',
    duration: 25,
    breakDuration: 5,
    checklist: [
      { id: 'check-001', text: 'Review lecture notes on integration by parts', completed: true },
      { id: 'check-002', text: 'Complete exercises 1-5', completed: true },
      { id: 'check-003', text: 'Complete exercises 6-10', completed: false },
      { id: 'check-004', text: 'Review partial fractions method', completed: false },
    ],
    status: 'active',
    scheduledAt: hoursFromNow(1),
  },
  {
    id: 'session-002',
    taskId: 'task-002',
    taskTitle: 'Data Structures Assignment 3',
    duration: 50,
    breakDuration: 10,
    checklist: [
      { id: 'check-005', text: 'Implement BST insert operation', completed: true },
      { id: 'check-006', text: 'Implement BST delete operation', completed: false },
      { id: 'check-007', text: 'Implement BST search operation', completed: false },
      { id: 'check-008', text: 'Write unit tests', completed: false },
    ],
    status: 'pending',
    scheduledAt: daysFromNow(1),
  },
  {
    id: 'session-003',
    taskId: 'task-003',
    taskTitle: 'Physics Lab Report',
    duration: 45,
    breakDuration: 10,
    checklist: [
      { id: 'check-009', text: 'Organize experimental data', completed: false },
      { id: 'check-010', text: 'Write introduction and methodology', completed: false },
      { id: 'check-011', text: 'Analyze results and create graphs', completed: false },
    ],
    status: 'pending',
    scheduledAt: daysFromNow(1),
  },
  {
    id: 'session-004',
    taskId: 'task-004',
    taskTitle: 'English Composition Essay',
    duration: 60,
    breakDuration: 15,
    checklist: [
      { id: 'check-012', text: 'Research and gather sources', completed: false },
      { id: 'check-013', text: 'Create outline', completed: false },
      { id: 'check-014', text: 'Write first draft', completed: false },
      { id: 'check-015', text: 'Revise and proofread', completed: false },
    ],
    status: 'pending',
    scheduledAt: daysFromNow(2),
  },
];

// ============================================================================
// MOCK CALENDAR EVENTS
// ============================================================================

export const mockCalendarEvents: CalendarEvent[] = [
  // Task deadlines
  {
    id: 'event-001',
    title: 'Calculus II Problem Set 5 Due',
    type: 'task-deadline',
    date: daysFromNow(2),
    color: '#FF4D2E',
    taskId: 'task-001',
  },
  {
    id: 'event-002',
    title: 'Data Structures Assignment 3 Due',
    type: 'task-deadline',
    date: daysFromNow(3),
    color: '#FF4D2E',
    taskId: 'task-002',
  },
  {
    id: 'event-003',
    title: 'Physics Lab Report Due',
    type: 'task-deadline',
    date: daysFromNow(1),
    color: '#FF4D2E',
    taskId: 'task-003',
  },
  {
    id: 'event-004',
    title: 'English Composition Essay Due',
    type: 'task-deadline',
    date: daysFromNow(5),
    color: '#FF4D2E',
    taskId: 'task-004',
  },
  {
    id: 'event-005',
    title: 'Linear Algebra Midterm Review Due',
    type: 'task-deadline',
    date: daysFromNow(7),
    color: '#FF4D2E',
    taskId: 'task-006',
  },
  {
    id: 'event-006',
    title: 'Database Systems Project Due',
    type: 'task-deadline',
    date: daysFromNow(-3),
    color: '#FF4D2E',
    taskId: 'task-007',
  },
  {
    id: 'event-007',
    title: 'Operating Systems Assignment 2 Due',
    type: 'task-deadline',
    date: daysFromNow(4),
    color: '#FF4D2E',
    taskId: 'task-008',
  },
  {
    id: 'event-008',
    title: 'Discrete Mathematics Problem Set Due',
    type: 'task-deadline',
    date: daysFromNow(6),
    color: '#FF4D2E',
    taskId: 'task-009',
  },
  {
    id: 'event-009',
    title: 'Software Engineering Documentation Due',
    type: 'task-deadline',
    date: daysFromNow(8),
    color: '#FF4D2E',
    taskId: 'task-010',
  },

  // Study sessions
  {
    id: 'event-010',
    title: 'Study: Calculus II Problem Set 5',
    type: 'study-session',
    date: hoursFromNow(1),
    startTime: '14:00',
    endTime: '14:25',
    color: '#3b82f6',
    taskId: 'task-001',
  },
  {
    id: 'event-011',
    title: 'Study: Data Structures Assignment 3',
    type: 'study-session',
    date: daysFromNow(1),
    startTime: '09:00',
    endTime: '09:50',
    color: '#3b82f6',
    taskId: 'task-002',
  },
  {
    id: 'event-012',
    title: 'Study: Physics Lab Report',
    type: 'study-session',
    date: daysFromNow(1),
    startTime: '15:00',
    endTime: '15:45',
    color: '#3b82f6',
    taskId: 'task-003',
  },
  {
    id: 'event-013',
    title: 'Study: English Composition Essay',
    type: 'study-session',
    date: daysFromNow(2),
    startTime: '10:00',
    endTime: '11:00',
    color: '#3b82f6',
    taskId: 'task-004',
  },
  {
    id: 'event-014',
    title: 'Study: Linear Algebra Review',
    type: 'study-session',
    date: daysFromNow(3),
    startTime: '13:00',
    endTime: '14:00',
    color: '#3b82f6',
  },
  {
    id: 'event-015',
    title: 'Study: Discrete Mathematics',
    type: 'study-session',
    date: daysFromNow(4),
    startTime: '16:00',
    endTime: '17:00',
    color: '#3b82f6',
  },
  {
    id: 'event-016',
    title: 'Study: Web Development',
    type: 'study-session',
    date: daysFromNow(-1),
    startTime: '11:00',
    endTime: '12:30',
    color: '#3b82f6',
  },
  {
    id: 'event-017',
    title: 'Study: Operating Systems',
    type: 'study-session',
    date: daysFromNow(2),
    startTime: '14:00',
    endTime: '15:00',
    color: '#3b82f6',
  },
  {
    id: 'event-018',
    title: 'Study: Software Engineering',
    type: 'study-session',
    date: daysFromNow(5),
    startTime: '09:30',
    endTime: '10:30',
    color: '#3b82f6',
  },
  {
    id: 'event-019',
    title: 'Study: Database Systems',
    type: 'study-session',
    date: daysFromNow(-2),
    startTime: '13:00',
    endTime: '14:30',
    color: '#3b82f6',
  },
  {
    id: 'event-020',
    title: 'Study: Calculus II Review',
    type: 'study-session',
    date: daysFromNow(0),
    startTime: '10:00',
    endTime: '11:00',
    color: '#3b82f6',
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
    { subject: 'Data Structures', hours: 12.5 },
    { subject: 'Calculus II', hours: 9.0 },
    { subject: 'Physics Lab', hours: 7.5 },
    { subject: 'English Composition', hours: 5.0 },
    { subject: 'Web Development', hours: 14.0 },
  ],
  productivityByDay: [
    { day: 'Mon', score: 85, tasksCompleted: 3 },
    { day: 'Tue', score: 60, tasksCompleted: 2 },
    { day: 'Wed', score: 90, tasksCompleted: 4 },
    { day: 'Thu', score: 45, tasksCompleted: 1 },
    { day: 'Fri', score: 75, tasksCompleted: 3 },
    { day: 'Sat', score: 30, tasksCompleted: 1 },
    { day: 'Sun', score: 20, tasksCompleted: 0 },
  ],
  streak: 5,
  totalFocusMinutes: 840,
  totalTasksCompleted: 23,
};

// ============================================================================
// MOCK USER
// ============================================================================

export const mockUser: UserProfile = {
  uid: 'mock-user-001',
  email: 'student@scholar.plot',
  displayName: 'Alex Scholar',
  avatarUrl: undefined,
};

// ============================================================================
// MOCK NOTIFICATIONS
// ============================================================================

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    taskTitle: 'Calculus II Problem Set 5',
    message: 'Your future self is already thanking you for this moment of focus.',
    deadline: daysFromNow(2),
    type: 'reminder',
  },
  {
    id: 'n2',
    taskTitle: 'Data Structures Assignment 3',
    message: 'Every expert was once a beginner. You\'re building mastery right now.',
    deadline: daysFromNow(1),
    type: 'deadline-approaching',
  },
  {
    id: 'n3',
    taskTitle: 'Physics Lab Report',
    message: 'The only way to do great work is to love what you do. Start now.',
    deadline: daysFromNow(1),
    type: 'deadline-approaching',
  },
  {
    id: 'n4',
    taskTitle: 'English Composition Essay',
    message: 'Success is the sum of small efforts repeated day in and day out.',
    deadline: daysFromNow(5),
    type: 'reminder',
  },
  {
    id: 'n5',
    taskTitle: 'Linear Algebra Midterm Review',
    message: 'You\'ve got this! One step at a time, one problem at a time.',
    deadline: daysFromNow(7),
    type: 'reminder',
  },
  {
    id: 'n6',
    taskTitle: 'Discrete Mathematics Problem Set',
    message: 'Progress over perfection. Every line of code brings you closer.',
    deadline: daysFromNow(6),
    type: 'reminder',
  },
  {
    id: 'n7',
    taskTitle: 'Operating Systems Assignment 2',
    message: 'Your dedication today is the foundation of tomorrow\'s success.',
    deadline: daysFromNow(4),
    type: 'reminder',
  },
  {
    id: 'n8',
    taskTitle: 'Software Engineering Documentation',
    message: 'Great things never came from comfort zones. You\'re doing amazing.',
    deadline: daysFromNow(8),
    type: 'reminder',
  },
];
