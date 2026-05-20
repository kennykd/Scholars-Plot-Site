import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIResponse } from '../../../types/index';
import { aiRequestSchema } from '../../../lib/validation/ai';
import { runTaskAnalysis } from '@/lib/services/aiService';

/**
 * NOTE (20/5/2026):
 * Swagger documentation for this API route has NOT been updated yet.
 */

/**
 * @swagger
 * /api/ai:
 *   post:
 *     summary: Send a message to the AI and get a response
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: The user's input message or prompt
 *                 example: "Help me create a study plan for my math exam"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional list of attachment file names or URLs
 *                 example: ["notes.pdf", "slides.png"]
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: AI response generated successfully
 *                 aiResponse:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     chatResponse:
 *                       type: string
 *                       description: The AI's natural language response
 *                       example: "I've analyzed your input. Here's what I found based on: \"Help me create a study plan\""
 *                     jsonFormat:
 *                       description: Optional structured output — a task, study session, or project to be created
 *                       oneOf:
 *                         - $ref: '#/components/schemas/CreateTaskInput'
 *                         - $ref: '#/components/schemas/CreateStudyInput'
 *                         - $ref: '#/components/schemas/CreateProjectInput'
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-03-12T10:00:00.000Z"
 *       400:
 *         description: Invalid request body or validation failure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Validation failed
 *                 errors:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 *                   example:
 *                     message: ["Message is required"]
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error generating AI response
 *
 * components:
 *   schemas:
 *     CreateTaskInput:
 *       type: object
 *       required:
 *         - title
 *         - deadline
 *         - status
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           example: "Finish math assignment"
 *         description:
 *           type: string
 *           example: "Complete chapters 3-5"
 *         deadline:
 *           type: string
 *           format: date-time
 *           example: "2026-04-01T23:59:00.000Z"
 *         status:
 *           type: string
 *           enum: [todo, in-progress, done]
 *           example: "todo"
 *         priority:
 *           type: number
 *           minimum: 0.5
 *           maximum: 5
 *           example: 3
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *           example: ["notes.pdf"]
 *         reminder:
 *           type: string
 *           enum: [daily, every-3-days, weekly, none]
 *           example: "daily"
 *     CreateStudyInput:
 *       type: object
 *       required:
 *         - taskId
 *         - taskTitle
 *         - duration
 *         - breakDuration
 *         - checklist
 *         - status
 *       properties:
 *         taskId:
 *           type: string
 *           example: "abc-123"
 *         taskTitle:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           example: "Study calculus"
 *         duration:
 *           type: number
 *           minimum: 1
 *           example: 25
 *         breakDuration:
 *           type: number
 *           minimum: 0
 *           example: 5
 *         checklist:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               text:
 *                 type: string
 *               completed:
 *                 type: boolean
 *           example:
 *             - id: "123e4567-e89b-12d3-a456-426614174000"
 *               text: "Read chapter 3"
 *               completed: false
 *         status:
 *           type: string
 *           enum: [pending, active, completed]
 *           example: "pending"
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *           example: "2026-04-01T09:00:00.000Z"
 *     CreateProjectInput:
 *       type: object
 *       required:
 *         - name
 *         - ownerId
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           example: "Group Research Project"
 *         description:
 *           type: string
 *           example: "Collaborative project for bio class"
 *         project_status:
 *           type: string
 *           enum: [active, completed, archived]
 *           example: active
 *         ownerId:
 *           type: string
 *           minLength: 1
 *           example: "user-uid-123"
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               handle:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [owner, moderator, member]
 *           example:
 *             - id: "user-uid-456"
 *               name: "Alice"
 *               handle: "alice@example.com"
 *               role: "member"
 */

const ReAnalyzeSchema = z.object({
  task_id: z.number().int().positive(),
  user_id: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ReAnalyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    await runTaskAnalysis(parsed.data.task_id, parsed.data.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Re-analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}