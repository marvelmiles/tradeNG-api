import { Request, Response } from "express";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { uploadBufferToCloudinary } from "@/utils/upload";

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    throw new AppError("At least one image file is required", 400);
  }

  let uploaded;
  try {
    uploaded = await Promise.all(
      files.map((file) =>
        uploadBufferToCloudinary(file.buffer, {
          folder: `tradeng/uploads/${req.user!.id}`,
          resource_type: "image",
        })
      )
    );
  } catch {
    throw new AppError("Media upload failed, please retry", 502);
  }

  return sendSuccess({
    res,
    code: 201,
    message: "Images uploaded successfully",
    data: { images: uploaded.map((u) => u.url) },
  });
});

export const uploadVideo = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;

  if (!file) throw new AppError("A video file is required", 400);

  let uploaded;
  try {
    uploaded = await uploadBufferToCloudinary(file.buffer, {
      folder: `tradeng/uploads/${req.user!.id}`,
      resource_type: "video",
    });
  } catch {
    throw new AppError("Media upload failed, please retry", 502);
  }

  return sendSuccess({
    res,
    code: 201,
    message: "Video uploaded successfully",
    data: { video: uploaded.url },
  });
});
