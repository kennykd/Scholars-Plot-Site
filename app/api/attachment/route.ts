import { NextResponse } from "next/server";
import { uploadFile, getFileUrl } from "@/lib/bucket";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/firebase/auth";

export async function POST(req) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "User is not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file"); // Has to match with frontend form field name

    if (!file) {
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
      url: url                  // To be sent to the frontend to display the file
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file"); // Has to match with frontend form field name

    if (!file) {
      return NextResponse.json({ error: "No file name provided" }, { status: 400 });
    }

    const url = await getFileUrl(file.name);

    return NextResponse.json({ 
      success: true,
      fileName: file.name, // To let the user know which file this URL is for
      url: url             // To be sent to the frontend to display the file
    });

  } catch (error) {
    console.error("Read error:", error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
