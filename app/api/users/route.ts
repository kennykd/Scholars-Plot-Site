// THIS FILE IS ONLY FOR SWAGGER TESTING, IT IS STILL HAVING THE HARDCODED DATA

import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     responses:
 *       200:
 *         description: List of users
 *   post:
 *     summary: Create new user 
 *     responses:
 *       201:
 *         description: User created
 *   put:
 *     summary: Update user
 *     responses:
 *       200:
 *         description: User updated
 *   delete:
 *     summary: Delete user
 *     responses:
 *       200:
 *         description: User deleted
 */

export async function GET() {
    return NextResponse.json([
        {id:1, name:"barry"},
        {id:2, name:"rafie"},
        {id:3, name:"kenny"}
    ]);
}

export async function POST() {
    return NextResponse.json(
        { message: "User created successfully", data: { id: 4, name: "superman" } },
        { status: 201 }
    );
}

export async function PUT() {
    return NextResponse.json({
        message: "User updated successfully",
        data: { id: 1, name: "barry-updated" }
    });
}

export async function DELETE() {
    return NextResponse.json({
        message: "User deleted successfully",
        data: { id: 1 }
    });
}