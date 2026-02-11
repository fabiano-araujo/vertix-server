import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// Cloudflare R2 Configuration
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-ea9841fef0bb48b8ba58fd0e872de7f5.r2.dev';
const R2_API_URL = process.env.R2_API_URL || 'https://777d473ac4d2c33a9f0500ba20731cf1.r2.cloudflarestorage.com';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vertix';

// Initialize R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_API_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// Types
export interface UploadResult {
  key: string;
  publicUrl: string;
  size?: number;
}

export interface SeriesStorageConfig {
  seriesId: number | string;
}

type ImageFolder = 'covers' | 'thumbnails' | 'profiles' | 'frames';
type ContentType = 'video/mp4' | 'video/webm' | 'image/jpeg' | 'image/png' | 'image/webp';

// ============================================
// VIDEO UPLOAD
// ============================================

/**
 * Upload video to R2 storage
 */
export const uploadVideo = async (
  buffer: Buffer,
  filename: string,
  seriesId?: number | string,
  episodeNumber?: number
): Promise<UploadResult> => {
  const extension = path.extname(filename) || '.mp4';
  const uniqueId = uuidv4();

  let key: string;
  if (seriesId && episodeNumber !== undefined) {
    // Structured path for series episodes
    key = `content/series/${seriesId}/episodes/ep${episodeNumber}${extension}`;
  } else if (seriesId) {
    key = `content/series/${seriesId}/videos/${uniqueId}${extension}`;
  } else {
    key = `videos/${uniqueId}${extension}`;
  }

  const contentType = getVideoContentType(extension);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    })
  );

  console.log(`[Storage] Video uploaded: ${key}`);

  return {
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`,
    size: buffer.length,
  };
};

/**
 * Upload video from URL (download and re-upload to R2)
 */
export const uploadVideoFromUrl = async (
  videoUrl: string,
  seriesId?: number | string,
  episodeNumber?: number
): Promise<UploadResult> => {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video from URL: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `video_${Date.now()}.mp4`;

  return uploadVideo(buffer, filename, seriesId, episodeNumber);
};

// ============================================
// IMAGE UPLOAD
// ============================================

/**
 * Upload image to R2 storage
 */
export const uploadImage = async (
  buffer: Buffer,
  filename: string,
  folder: ImageFolder = 'covers',
  seriesId?: number | string
): Promise<UploadResult> => {
  const extension = path.extname(filename) || '.jpg';
  const uniqueId = uuidv4();

  let key: string;
  if (seriesId && (folder === 'covers' || folder === 'thumbnails')) {
    // Structured path for series assets
    const assetName = folder === 'covers' ? 'cover' : 'thumb';
    key = `content/series/${seriesId}/${assetName}${extension}`;
  } else {
    key = `${folder}/${uniqueId}${extension}`;
  }

  const contentType = getImageContentType(extension);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    })
  );

  console.log(`[Storage] Image uploaded: ${key}`);

  return {
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`,
    size: buffer.length,
  };
};

/**
 * Upload image from URL
 */
export const uploadImageFromUrl = async (
  imageUrl: string,
  folder: ImageFolder = 'covers',
  seriesId?: number | string
): Promise<UploadResult> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from URL: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const extension = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const filename = `image_${Date.now()}${extension}`;

  return uploadImage(buffer, filename, folder, seriesId);
};

/**
 * Upload base64 image
 */
export const uploadBase64Image = async (
  base64Data: string,
  folder: ImageFolder = 'covers',
  seriesId?: number | string
): Promise<UploadResult> => {
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  // Detect format from data URL or default to jpg
  let extension = '.jpg';
  if (base64Data.includes('data:image/png')) extension = '.png';
  else if (base64Data.includes('data:image/webp')) extension = '.webp';

  const filename = `image_${Date.now()}${extension}`;

  return uploadImage(buffer, filename, folder, seriesId);
};

// ============================================
// URL HELPERS
// ============================================

/**
 * Get public URL for a storage key
 */
export const getPublicUrl = (key: string): string => {
  if (key.startsWith('http')) {
    return key; // Already a full URL
  }
  return `${R2_PUBLIC_URL}/${key}`;
};

/**
 * Get signed URL for private access (with expiration)
 */
export const getSignedUploadUrl = async (
  key: string,
  contentType: ContentType,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
};

/**
 * Generate pre-signed URL for direct upload from client
 */
export const generateUploadUrl = async (
  type: 'video' | 'image',
  folder?: string,
  seriesId?: number | string
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> => {
  const uniqueId = uuidv4();
  const extension = type === 'video' ? '.mp4' : '.jpg';
  const contentType: ContentType = type === 'video' ? 'video/mp4' : 'image/jpeg';

  let key: string;
  if (seriesId && folder) {
    key = `content/series/${seriesId}/${folder}/${uniqueId}${extension}`;
  } else if (folder) {
    key = `${folder}/${uniqueId}${extension}`;
  } else {
    key = `${type}s/${uniqueId}${extension}`;
  }

  const uploadUrl = await getSignedUploadUrl(key, contentType);

  return {
    uploadUrl,
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`,
  };
};

// ============================================
// FILE MANAGEMENT
// ============================================

/**
 * Delete file from R2 storage
 */
export const deleteFile = async (key: string): Promise<void> => {
  // Extract key from full URL if needed
  const cleanKey = key.replace(R2_PUBLIC_URL + '/', '');

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: cleanKey,
    })
  );

  console.log(`[Storage] File deleted: ${cleanKey}`);
};

/**
 * Delete all files for a series
 */
export const deleteSeriesFiles = async (seriesId: number | string): Promise<void> => {
  const prefix = `content/series/${seriesId}/`;

  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await r2Client.send(listCommand);

  if (response.Contents && response.Contents.length > 0) {
    for (const object of response.Contents) {
      if (object.Key) {
        await deleteFile(object.Key);
      }
    }
  }

  console.log(`[Storage] All files deleted for series: ${seriesId}`);
};

/**
 * Check if file exists
 */
export const fileExists = async (key: string): Promise<boolean> => {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
};

// ============================================
// SERIES ASSET STRUCTURE
// ============================================

/**
 * Get standard paths for series assets
 */
export const getSeriesAssetPaths = (seriesId: number | string) => ({
  cover: `content/series/${seriesId}/cover.jpg`,
  thumbnail: `content/series/${seriesId}/thumb.jpg`,
  episodeVideo: (epNumber: number) => `content/series/${seriesId}/episodes/ep${epNumber}.mp4`,
  episodeThumbnail: (epNumber: number) => `content/series/${seriesId}/episodes/ep${epNumber}_thumb.jpg`,
});

/**
 * Get public URLs for series assets
 */
export const getSeriesAssetUrls = (seriesId: number | string) => {
  const paths = getSeriesAssetPaths(seriesId);
  return {
    cover: getPublicUrl(paths.cover),
    thumbnail: getPublicUrl(paths.thumbnail),
    episodeVideo: (epNumber: number) => getPublicUrl(paths.episodeVideo(epNumber)),
    episodeThumbnail: (epNumber: number) => getPublicUrl(paths.episodeThumbnail(epNumber)),
  };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getVideoContentType(extension: string): ContentType {
  const ext = extension.toLowerCase();
  if (ext === '.webm') return 'video/webm';
  return 'video/mp4';
}

function getImageContentType(extension: string): ContentType {
  const ext = extension.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Video
  uploadVideo,
  uploadVideoFromUrl,
  // Image
  uploadImage,
  uploadImageFromUrl,
  uploadBase64Image,
  // URLs
  getPublicUrl,
  getSignedUploadUrl,
  generateUploadUrl,
  // Management
  deleteFile,
  deleteSeriesFiles,
  fileExists,
  // Series helpers
  getSeriesAssetPaths,
  getSeriesAssetUrls,
};
