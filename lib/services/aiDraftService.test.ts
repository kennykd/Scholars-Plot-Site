import {
  generateStudyTrackDraft,
  generateTaskDraft,
} from "@/lib/services/aiDraftService";
import { geminiFlash } from "@/lib/gemini";
import { uploadRemotePDF } from "@/lib/ai/uploadPdf";
import { uploadRemoteImage } from "@/lib/ai/uploadImage";

jest.mock("@/lib/gemini", () => ({
  __esModule: true,
  default: { files: {} },
  geminiFlash: {
    generateContent: jest.fn(),
  },
}));

jest.mock("@/lib/ai/uploadPdf", () => ({
  uploadRemotePDF: jest.fn(),
}));

jest.mock("@/lib/ai/uploadImage", () => ({
  uploadRemoteImage: jest.fn(),
}));

describe("aiDraftService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (uploadRemotePDF as jest.Mock).mockResolvedValue({
      uri: "gemini://pdf",
      name: "files/pdf",
      state: "ACTIVE",
    });
    (uploadRemoteImage as jest.Mock).mockResolvedValue({
      file: { uri: "gemini://image", name: "files/image", state: "ACTIVE" },
      mimeType: "image/png",
    });
  });

  it("sends task title, description, and supported attachment parts to Gemini", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: JSON.stringify({
        title: "Refined lab report",
        description: "Write the lab report with method and results sections.",
        priority: 4,
        reasoning: "The PDF clarifies the expected deliverable.",
      }),
    });

    const result = await generateTaskDraft({
      title: "lab",
      description: "finish report",
      deadline: new Date("2099-03-20T16:00:00.000Z"),
      priority: 2.5,
      attachments: [
        {
          fileName: "rubric.pdf",
          fileType: "application/pdf",
          url: "https://signed.example/rubric.pdf",
        },
        {
          fileName: "notes.txt",
          fileType: "text/plain",
          url: "https://signed.example/notes.txt",
        },
      ],
    });

    expect(uploadRemotePDF).toHaveBeenCalledWith(
      expect.anything(),
      "https://signed.example/rubric.pdf",
      "rubric.pdf",
    );
    expect(geminiFlash.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseMimeType: "application/json",
          responseJsonSchema: expect.any(Object),
        }),
        contents: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            parts: expect.arrayContaining([
              expect.objectContaining({ text: expect.stringContaining("lab") }),
              {
                fileData: {
                  fileUri: "gemini://pdf",
                  mimeType: "application/pdf",
                },
              },
            ]),
          }),
        ]),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        title: "Refined lab report",
        priority: 4,
        skippedAttachments: [
          { fileName: "notes.txt", fileType: "text/plain", reason: "Unsupported file type" },
        ],
      }),
    );
  });

  it("normalizes study track drafts into batch creation track shape", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: JSON.stringify({
        tracks: [
          {
            title: "Mechanics review",
            start_date: "2099-03-21",
            repeat: "none",
            time: "15:30",
            focus_minutes: 30,
            break_minutes: 5,
            total_pomodoros: 2,
            notes: "Review force diagrams",
            description_as_checklist: true,
          },
        ],
        warnings: [],
        reasoning: "The session is before the deadline.",
      }),
    });

    const result = await generateStudyTrackDraft({
      task: {
        id: 42,
        title: "Physics Final",
        description: "Mechanics",
        deadline: new Date("2099-03-31T23:59:00.000Z"),
        priority: 4,
      },
      preferences: {
        focus_minutes: 25,
        break_minutes: 5,
        total_pomodoros: 2,
        total_minutes: 60,
      },
      availability: [{ day_of_week: 1, start_time: "15:00", end_time: "17:00" }],
      behaviorProfile: null,
      attachments: [
        {
          fileName: "diagram.png",
          fileType: "image/png",
          url: "https://signed.example/diagram.png",
        },
      ],
    });

    expect(uploadRemoteImage).toHaveBeenCalledWith(
      expect.anything(),
      "https://signed.example/diagram.png",
      "diagram.png",
    );
    expect(result.tracks).toEqual([
      expect.objectContaining({
        title: "Mechanics review",
        start_date: "2099-03-21",
        repeat: "none",
        time: "15:30",
        focus_minutes: 30,
        break_minutes: 5,
        total_pomodoros: 2,
        notes: "Review force diagrams",
        description_as_checklist: true,
      }),
    ]);
  });
});
