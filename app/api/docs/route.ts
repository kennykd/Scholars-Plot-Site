import { swaggerSpec } from "@/lib/swagger/swagger";
import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Return the generated OpenAPI document
 *     tags:
 *       - Docs
 *     description: Returns the Swagger/OpenAPI JSON assembled from route comments.
 *     responses:
 *       200:
 *         description: OpenAPI document.
 *   post:
 *     summary: Return the generated OpenAPI document
 *     tags:
 *       - Docs
 *     description: Mirrors GET and returns the same Swagger/OpenAPI JSON.
 *     responses:
 *       200:
 *         description: OpenAPI document.
 */
export async function GET(){
    return NextResponse.json(swaggerSpec)
}

export async function POST(){
    return NextResponse.json(swaggerSpec)
}
