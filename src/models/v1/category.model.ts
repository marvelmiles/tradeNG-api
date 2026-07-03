import { Schema, model, Document, Types } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  image: string | null;
  is_active: boolean;
  requested_by: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    image: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    requested_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "categories",
    versionKey: false,
  }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ is_active: 1 });

export const Category = model<ICategory>("Category", categorySchema);
