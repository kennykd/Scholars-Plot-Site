import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/users:
 *      get:
 *          summary: Get all users
 *          responses:
 *              200:
*                   description: List of users
 * 
 */

export async function GET() {
    return NextResponse.json([
        {id:1, name:"barry"},
        {id:2, name:"jokowi"},
        {id:3, name:"anies"}
    ]);
}