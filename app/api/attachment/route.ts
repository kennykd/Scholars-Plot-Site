import { NextResponse } from "next/server";
import { uploadFile, getFileUrl } from "@/lib/bucket";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/firebase/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert the file to a Buffer that the SDK can send
    const buffer = Buffer.from(await file.arrayBuffer());

    // Give it a unique name scoped to the authenticated user
    const uniqueFileName = `uploads/${session.id}-${uuidv4()}-${file.name}`;

    // Upload to the storage bucket
    await uploadFile(buffer, uniqueFileName, file.type);

    // Get a temporary URL to return to the frontend
    const url = await getFileUrl(uniqueFileName);

    return NextResponse.json({
      success: true,
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
