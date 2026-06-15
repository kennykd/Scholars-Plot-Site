const sendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn(function PutObjectCommand(input) {
    this.input = input;
  }),
  GetObjectCommand: jest.fn(function GetObjectCommand(input) {
    this.input = input;
  }),
  DeleteObjectCommand: jest.fn(function DeleteObjectCommand(input) {
    this.input = input;
  }),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/file.pdf"),
}));

describe("bucket B2 wrapper", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sendMock.mockResolvedValue({});
    process.env.B2_REGION = "us-east-005";
    process.env.B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
    process.env.B2_KEY_ID = "key-id";
    process.env.B2_APP_KEY = "app-key";
    process.env.B2_BUCKET_NAME = "bucket-name";
  });

  it("uploads files to the configured B2 bucket with content type", async () => {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { uploadFile } = await import("@/lib/bucket");

    await uploadFile(Buffer.from("pdf"), "uploads/file.pdf", "application/pdf");

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-name",
      Key: "uploads/file.pdf",
      Body: Buffer.from("pdf"),
      ContentType: "application/pdf",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("generates signed get URLs for private B2 files", async () => {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { getFileUrl } = await import("@/lib/bucket");

    const url = await getFileUrl("uploads/file.pdf");

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-name",
      Key: "uploads/file.pdf",
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
    expect(url).toBe("https://signed.example/file.pdf");
  });

  it("deletes B2 objects by key", async () => {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { deleteFile } = await import("@/lib/bucket");

    await deleteFile("uploads/file.pdf");

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-name",
      Key: "uploads/file.pdf",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
