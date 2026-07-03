import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { cloudinary } from "@/lib/cloudinary";
import { AppError } from "@/utils/AppError";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"];

const imageFileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
    cb(new AppError("Only JPEG, PNG or WEBP images are allowed", 400));
    return;
  }
  cb(null, true);
};

const videoFileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (!VIDEO_MIME_TYPES.includes(file.mimetype)) {
    cb(new AppError("Only MP4 or MOV videos are allowed", 400));
    return;
  }
  cb(null, true);
};

export const imageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: imageFileFilter,
}).array("images", 8);

export const videoUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: videoFileFilter,
}).single("video");

interface UploadResult {
  url: string;
  public_id: string;
}

interface UploadOptions {
  folder: string;
  resource_type: "image" | "video";
}

export const uploadBufferToCloudinary = (buffer: Buffer, options: UploadOptions): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: options.folder, resource_type: options.resource_type },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Media upload failed"));
          return;
        }
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
};
