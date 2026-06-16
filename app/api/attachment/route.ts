import { NextResponse } from "next/server";
import { uploadFile, getFileUrl } from "@/lib/bucket";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/firebase/auth";

/**
 * @swagger
 * /api/attachment:
 *   post:
 *     summary: Upload a standalone attachment
 *     tags:
 *       - Attachments
 *     description: >
 *       Requires the session cookie. Accepts multipart form data with a `file`, uploads
 *       it to storage under a unique key, creates an attachment row, and returns a
 *       temporary URL.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Attachment uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 attachment_id:
 *                   type: integer
 *                 fileName:
 *                   type: string
 *                 url:
 *                   type: string
 *       400:
 *         description: No file provided.
 *       401:
 *         description: User is not authenticated.
 *       500:
 *         description: Upload failed.
 *   get:
 *     summary: Get a temporary URL for an uploaded file
 *     tags:
 *       - Attachments
 *     description: >
 *       Requires the session cookie. The implementation reads multipart form data
 *       from the GET request and expects a `file` entry containing the file key or File.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 oneOf:
 *                   - type: string
 *                   - type: string
 *                     format: binary
 *     responses:
 *       200:
 *         description: Temporary URL returned.
 *       400:
 *         description: No file name provided.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Read failed.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "User is not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert the file to a Buffer that the SDK can send
    const buffer = Buffer.from(await file.arrayBuffer());

    // Give it a unique name so files don't overwrite each other
    const uniqueFileName = `uploads/${session.id}-${uuidv4()}-${file.name}`;

    // Upload to the storage bucket
    await uploadFile(buffer, uniqueFileName, file.type);

    // Create attachment record in database
    const attachment = await prisma.attachment.create({
      data: {
        file_name: file.name,
        file_path: uniqueFileName,
        file_type: file.type,
      },
    });

    // Get a temporary URL to return to the frontend
    const url = await getFileUrl(uniqueFileName);

    return NextResponse.json({
      success: true,
      attachment_id: attachment.attachment_id,
      fileName: uniqueFileName, // To be saved in the database
      url: url,                 // To be sent to the frontend to display the file
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file name provided" }, { status: 400 });
    }

    const fileName = typeof file === "string" ? file : file.name;
    const url = await getFileUrl(fileName);

    return NextResponse.json({
      success: true,
      fileName,
      url,
    });

  } catch (error) {
    console.error("Read error:", error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
