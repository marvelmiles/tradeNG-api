import "@/config/env";
import { connectDB, disconnectDB } from "@/config/db";
import { Category } from "@/models/v1/category.model";
import { slugify } from "@/utils/slugify";

const DEFAULT_CATEGORIES: { name: string; image: string }[] = [
  { name: "Gadgets", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/gadgets.png" },
  { name: "Furniture", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/furniture.png" },
  { name: "Fashion", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/fashion.png" },
  { name: "Electronics", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/electronics.png" },
  { name: "Home", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/home.png" },
  { name: "Others", image: "https://res.cloudinary.com/demo/image/upload/v1/tradeng/categories/others.png" },
];

const seedCategories = async (): Promise<void> => {
  for (const category of DEFAULT_CATEGORIES) {
    const slug = slugify(category.name);
    await Category.findOneAndUpdate(
      { slug },
      { name: category.name, slug, image: category.image, is_active: true },
      { upsert: true, new: true }
    );
  }
  console.log(`[Seed] Seeded ${DEFAULT_CATEGORIES.length} default categories`);
};

const main = async (): Promise<void> => {
  await connectDB();
  await seedCategories();
  await disconnectDB();
};

main().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
