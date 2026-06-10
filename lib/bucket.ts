import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // During build time, return a dummy value so module can load
    if (process.env.NODE_ENV === 'production' && !process.env.B2_REGION) {
      return '';
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let s3Client: S3Client | null = null;
let bucketName: string | null = null;

function initializeS3() {
  if (s3Client && bucketName) return { s3Client, bucketName };
  
  const region = requireEnv("B2_REGION");
  const endpoint = requireEnv("B2_ENDPOINT");
  const keyId = requireEnv("B2_KEY_ID");
  const appKey = requireEnv("B2_APP_KEY");
  bucketName = requireEnv("B2_BUCKET_NAME");

  // Only initialize if all vars are present
  if (region && endpoint && keyId && appKey && bucketName) {
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });
  }
  
  return { s3Client, bucketName };
}

export function getBucket(): string {
  return initializeS3().bucketName || '';
}

export async function uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string) {
  const { s3Client, bucketName } = initializeS3();
  if (!s3Client || !bucketName) throw new Error('S3 not initialized');
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return fileName;
}

export async function getFileUrl(fileName: string) {
  const { s3Client, bucketName } = initializeS3();
  if (!s3Client || !bucketName) throw new Error('S3 not initialized');
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

export async function deleteFile(fileName: string) {
  const { s3Client, bucketName } = initializeS3();
  if (!s3Client || !bucketName) throw new Error('S3 not initialized');
  
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileName,
  });

  await s3Client.send(command);
}
