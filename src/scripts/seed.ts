import "@/config/env";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { env } from "@/config/env";
import { connectDB, disconnectDB } from "@/config/db";
import { slugify } from "@/utils/slugify";

import { User, IUser } from "@/models/v1/user.model";
import { Category, ICategory } from "@/models/v1/category.model";
import { CategoryRequest } from "@/models/v1/category_request.model";
import { Listing, IListing } from "@/models/v1/listing.model";
import { Offer } from "@/models/v1/offer.model";
import { Conversation } from "@/models/v1/conversation.model";
import { Message } from "@/models/v1/message.model";
import { Transaction, ITransaction } from "@/models/v1/transaction.model";
import { Dispute } from "@/models/v1/dispute.model";
import { Review } from "@/models/v1/review.model";
import { Notification, NotificationType } from "@/models/v1/notification.model";
import { WalletLedgerEntry } from "@/models/v1/wallet_ledger_entry.model";
import { WithdrawalRequest } from "@/models/v1/withdrawal_request.model";
import { PayoutBank } from "@/models/v1/payout_bank.model";
import { WishlistItem } from "@/models/v1/wishlist.model";
import { ContactMessage } from "@/models/v1/contact_message.model";
import { Otp } from "@/models/v1/otp.model";
import { VerificationReminder } from "@/models/v1/verification_reminder.model";

import { createTransactionForSale } from "@/api/v1/services/transaction.service";
import {
  getOrCreateConversation,
  persistMessage,
} from "@/api/v1/services/message.service";

const SEED_PASSWORD = "Passw0rd1";
const daysAgo = (n: number): Date =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// Picsum Photos serves real, publicly-hosted stock photos with no API key —
// `seed` makes the same URL always resolve to the same image, so re-seeding
// is deterministic without depending on Cloudinary or any project account.
const stockImage = (seed: string, width = 800, height = 600): string =>
  `https://picsum.photos/seed/${slugify(seed)}/${width}/${height}`;

// Pravatar serves free, publicly-hosted placeholder avatar photos, seeded the
// same way for deterministic per-user results.
const avatar = (seed: string): string =>
  `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;

// Real product photos supplied for a handful of listings, so those items show
// an image that actually matches their title/category instead of a random
// stock photo.
const PRODUCT_IMAGES = {
  jblFlip6:
    "https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw593abf39/2_JBL_FLIP6_3_4_RIGHT_BLACK_30195_x1.png?sw=535&sh=535",
  dellXps:
    "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZGVsbCUyMHhwc3xlbnwwfHwwfHx8MA%3D%3D",
  ankaraJacket:
    "https://images.unsplash.com/photo-1663044022726-889ee51a682e?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YW5rYXJhJTIwamFja2V0fGVufDB8fDB8fHww",
  diningTable:
    "https://plus.unsplash.com/premium_photo-1675744019321-f90d6d719da7?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8ZGlubmluZyUyMHRhYmxlfGVufDB8fDB8fHww",
  iphone17:
    "data:image/jpeg;base64,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",
} as const;

const DEFAULT_CATEGORIES: { name: string; image: string }[] = [
  { name: "Gadgets", image: stockImage("category-gadgets") },
  { name: "Furniture", image: stockImage("category-furniture") },
  { name: "Fashion", image: stockImage("category-fashion") },
  { name: "Electronics", image: stockImage("category-electronics") },
  { name: "Home", image: stockImage("category-home") },
  { name: "Others", image: stockImage("category-others") },
];

// Collections fully owned by this seed script — wiped and rebuilt on every run.
// Category is intentionally excluded: Categories serve as app default categories.
const wipeSeedData = async (): Promise<void> => {
  await Promise.all([
    User.deleteMany({}),
    Listing.deleteMany({}),
    Offer.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Transaction.deleteMany({}),
    Dispute.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    WalletLedgerEntry.deleteMany({}),
    WithdrawalRequest.deleteMany({}),
    PayoutBank.deleteMany({}),
    WishlistItem.deleteMany({}),
    CategoryRequest.deleteMany({}),
    ContactMessage.deleteMany({}),
    Otp.deleteMany({}),
    VerificationReminder.deleteMany({}),
  ]);
  console.log("[Seed] Cleared existing operational data");
};

const seedCategories = async (): Promise<Record<string, ICategory>> => {
  const by_slug: Record<string, ICategory> = {};

  for (const category of DEFAULT_CATEGORIES) {
    const slug = slugify(category.name);
    const doc = await Category.findOneAndUpdate(
      { slug },
      { name: category.name, slug, image: category.image, is_active: true },
      { upsert: true, new: true },
    );
    by_slug[slug] = doc;
  }

  console.log(`[Seed] Seeded ${DEFAULT_CATEGORIES.length} default categories`);
  return by_slug;
};

interface SeedUsers {
  adaeze: IUser; // top seller #1
  chidi: IUser; // top seller #2
  bola: IUser; // top seller #3
  ifeoma: IUser; // verified seller, fewer sales
  tunde: IUser; // unverified — never completed signup
  grace: IUser; // suspended account
  emeka: IUser; // regular buyer
  ngozi: IUser; // regular buyer, seller-verification pending
}

const seedUsers = async (): Promise<SeedUsers> => {
  const hashed = await bcrypt.hash(SEED_PASSWORD, 12);

  const make = (
    overrides: Partial<IUser> & {
      first_name: string;
      last_name: string;
      email: string;
    },
  ) =>
    User.create({
      password: hashed,
      status: "ACTIVE",
      is_verified_seller: false,
      profile_photo: avatar(overrides.email),
      ...overrides,
    });

  const [adaeze, chidi, bola, ifeoma, tunde, grace, emeka, ngozi] =
    await Promise.all([
      make({
        first_name: "Adaeze",
        last_name: "Okonkwo",
        email: "adaeze.seller@tradeng.dev",
        is_verified_seller: true,
        about:
          "Verified seller specializing in gadgets and electronics. Fast shipping, honest listings.",
        address: "12 Admiralty Way, Lekki Phase 1",
        created_at: daysAgo(120),
      }),
      make({
        first_name: "Chidi",
        last_name: "Umeh",
        email: "chidi.seller@tradeng.dev",
        is_verified_seller: true,
        about: "Furniture and home goods, always negotiable.",
        address: "5 Ademola Adetokunbo Crescent, Wuse 2",
        created_at: daysAgo(100),
      }),
      make({
        first_name: "Bola",
        last_name: "Adigun",
        email: "bola.seller@tradeng.dev",
        is_verified_seller: true,
        about: "Fashion reseller. Authentic pieces only.",
        created_at: daysAgo(90),
      }),
      make({
        first_name: "Ifeoma",
        last_name: "Nwosu",
        email: "ifeoma.seller@tradeng.dev",
        is_verified_seller: true,
        about: "New to TradeNG, verified seller of electronics.",
        created_at: daysAgo(30),
      }),
      make({
        first_name: "Tunde",
        last_name: "Bakare",
        email: "tunde.unverified@tradeng.dev",
        status: "UNVERIFIED",
        delete_at: new Date(
          Date.now() + env.ACCOUNT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ),
        created_at: daysAgo(1),
      }),
      make({
        first_name: "Grace",
        last_name: "Effiong",
        email: "grace.suspended@tradeng.dev",
        status: "SUSPENDED",
        created_at: daysAgo(60),
      }),
      make({
        first_name: "Emeka",
        last_name: "Chukwu",
        email: "emeka.buyer@tradeng.dev",
        address: "8 Allen Avenue, Ikeja",
        created_at: daysAgo(75),
      }),
      make({
        first_name: "Ngozi",
        last_name: "Eze",
        email: "ngozi.buyer@tradeng.dev",
        verification_requested_at: daysAgo(2),
        created_at: daysAgo(50),
      }),
    ]);

  console.log(
    "[Seed] Seeded 8 users (4 sellers, 1 unverified, 1 suspended, 2 buyers)",
  );
  return { adaeze, chidi, bola, ifeoma, tunde, grace, emeka, ngozi };
};

interface SeedListings {
  active: IListing[];
  draft: IListing;
  cancelled: IListing;
  negotiable: IListing;
  toSell: Record<string, IListing>;
}

const seedListings = async (
  users: SeedUsers,
  categories: Record<string, ICategory>,
): Promise<SeedListings> => {
  const gadgets = categories["gadgets"]._id;
  const furniture = categories["furniture"]._id;
  const fashion = categories["fashion"]._id;
  const electronics = categories["electronics"]._id;
  const home = categories["home"]._id;

  const base = {
    delivery_options: ["SELF_DELIVERY", "PICKUP"],
    pickup_address: "Victoria Island, Lagos",
    status: "ACTIVE" as const,
  };

  const listingImages = (item_name: string): string[] => [
    stockImage(item_name),
    stockImage(`${item_name}-2`),
  ];

  const [
    l1_active,
    l2_negotiable,
    l3_draft,
    l4_sold,
    l5_sold,
    l6_sold,
    l7_active,
    l8_cancelled,
    l9_sold,
    l10_sold,
    l11_active,
    l12_sold,
    l13_sold,
    l14_active,
    l15_active,
    l18_active,
    l16_sold,
    l17_sold,
  ] = await Promise.all([
    Listing.create({
      ...base,
      item_name: 'MacBook Pro 14" M2',
      images: listingImages("MacBook Pro 14 M2"),
      category_id: gadgets,
      condition: "LIKE_NEW",
      description:
        "Barely used MacBook Pro, M2 chip, 16GB RAM, 512GB SSD. Comes with original box and charger.",
      price: 1450000,
      seller_id: users.adaeze._id,
      created_at: daysAgo(20),
    }),
    Listing.create({
      ...base,
      item_name: "iPhone 13 Pro 128GB",
      images: listingImages("iPhone 13 Pro 128GB"),
      category_id: electronics,
      condition: "USED",
      defect_description:
        "Minor scratch on the back glass, screen is flawless.",
      description:
        "iPhone 13 Pro in good condition, battery health 89%. Open to reasonable offers.",
      price: 350000,
      allow_price_negotiation: true,
      seller_id: users.adaeze._id,
      created_at: daysAgo(18),
    }),
    Listing.create({
      item_name: "Leather Office Chair",
      category_id: fashion,
      condition: "NEW",
      description:
        "Brand new ergonomic leather office chair, still in packaging. Draft — pending photos.",
      images: [],
      delivery_options: ["PICKUP"],
      pickup_address: "Lekki Phase 1, Lagos",
      price: 85000,
      seller_id: users.adaeze._id,
      status: "DRAFT",
      created_at: daysAgo(5),
    }),
    Listing.create({
      ...base,
      item_name: "Samsung Galaxy S22 Ultra",
      images: listingImages("Samsung Galaxy S22 Ultra"),
      category_id: gadgets,
      condition: "LIKE_NEW",
      description:
        "Samsung Galaxy S22 Ultra with S-Pen, 256GB. Sold with screen protector already applied.",
      price: 520000,
      seller_id: users.adaeze._id,
      created_at: daysAgo(40),
    }),
    Listing.create({
      ...base,
      item_name: "Sony WH-1000XM4 Headphones",
      images: listingImages("Sony WH-1000XM4 Headphones"),
      category_id: electronics,
      condition: "LIKE_NEW",
      description:
        "Noise-cancelling headphones, used for a month. Includes carry case.",
      price: 145000,
      seller_id: users.adaeze._id,
      created_at: daysAgo(35),
    }),
    Listing.create({
      ...base,
      item_name: "iPad Air 5th Gen",
      images: listingImages("iPad Air 5th Gen"),
      category_id: gadgets,
      condition: "USED",
      description:
        "iPad Air with Apple Pencil (2nd gen) included. Light scratches on the frame only.",
      price: 380000,
      seller_id: users.adaeze._id,
      created_at: daysAgo(15),
    }),
    Listing.create({
      ...base,
      item_name: "6-Seater Dining Table Set",
      images: [
        PRODUCT_IMAGES.diningTable,
        stockImage("6-Seater Dining Table Set-2"),
      ],
      category_id: furniture,
      condition: "USED",
      description:
        "Solid wood dining table with 6 chairs. Minor wear consistent with age.",
      price: 275000,
      seller_id: users.chidi._id,
      created_at: daysAgo(22),
    }),
    Listing.create({
      ...base,
      item_name: "Bookshelf Unit",
      images: listingImages("Bookshelf Unit"),
      category_id: furniture,
      condition: "USED",
      description:
        "5-tier wooden bookshelf. Cancelled — seller changed their mind.",
      price: 45000,
      seller_id: users.chidi._id,
      status: "CANCELLED",
      created_at: daysAgo(28),
    }),
    Listing.create({
      ...base,
      item_name: "Queen Size Bed Frame",
      images: listingImages("Queen Size Bed Frame"),
      category_id: furniture,
      condition: "LIKE_NEW",
      description: "Queen bed frame with headboard, used for under a year.",
      price: 190000,
      seller_id: users.chidi._id,
      created_at: daysAgo(45),
    }),
    Listing.create({
      ...base,
      item_name: "3-Seater Sofa",
      images: listingImages("3-Seater Sofa"),
      category_id: home,
      condition: "USED",
      description: "Comfortable fabric sofa, some wear on the armrests.",
      price: 165000,
      seller_id: users.chidi._id,
      created_at: daysAgo(38),
    }),
    Listing.create({
      ...base,
      item_name: "Designer Ankara Jacket",
      images: [
        PRODUCT_IMAGES.ankaraJacket,
        stockImage("Designer Ankara Jacket-2"),
      ],
      category_id: fashion,
      condition: "NEW",
      description: "Custom-tailored Ankara jacket, size L, never worn.",
      price: 65000,
      seller_id: users.bola._id,
      created_at: daysAgo(10),
    }),
    Listing.create({
      ...base,
      item_name: "Gucci Leather Belt",
      images: listingImages("Gucci Leather Belt"),
      category_id: fashion,
      condition: "LIKE_NEW",
      description:
        "Authentic Gucci belt, worn twice. Comes with dust bag and authenticity card.",
      price: 210000,
      seller_id: users.bola._id,
      created_at: daysAgo(33),
    }),
    Listing.create({
      ...base,
      item_name: "Nike Air Jordan 1 Retro",
      images: listingImages("Nike Air Jordan 1 Retro"),
      category_id: fashion,
      condition: "USED",
      description: "Size 42, worn a handful of times, no major damage.",
      price: 95000,
      seller_id: users.bola._id,
      created_at: daysAgo(12),
    }),
    Listing.create({
      ...base,
      item_name: "Dell XPS 13 Laptop",
      images: [PRODUCT_IMAGES.dellXps, stockImage("Dell XPS 13 Laptop-2")],
      category_id: electronics,
      condition: "LIKE_NEW",
      description: "Dell XPS 13, i7, 16GB RAM, 1TB SSD. Excellent condition.",
      price: 680000,
      seller_id: users.ifeoma._id,
      created_at: daysAgo(8),
    }),
    Listing.create({
      ...base,
      item_name: "JBL Flip 6 Bluetooth Speaker",
      images: [
        PRODUCT_IMAGES.jblFlip6,
        stockImage("JBL Flip 6 Bluetooth Speaker-2"),
      ],
      category_id: gadgets,
      condition: "NEW",
      description: "Sealed, never opened. Bought as a gift, no longer needed.",
      price: 68000,
      seller_id: users.ifeoma._id,
      created_at: daysAgo(6),
    }),
    Listing.create({
      ...base,
      item_name: "iPhone 17 256GB",
      images: [PRODUCT_IMAGES.iphone17, stockImage("iPhone 17 256GB-2")],
      category_id: electronics,
      condition: "NEW",
      description:
        "Brand new, sealed in box. Latest iPhone 17, purchased directly from the Apple Store.",
      price: 1250000,
      seller_id: users.ifeoma._id,
      created_at: daysAgo(3),
    }),
    Listing.create({
      ...base,
      item_name: "PlayStation 5 Console",
      images: listingImages("PlayStation 5 Console"),
      category_id: gadgets,
      condition: "LIKE_NEW",
      description: "PS5 disc edition with one extra controller. Light usage.",
      price: 620000,
      seller_id: users.ifeoma._id,
      created_at: daysAgo(25),
    }),
    Listing.create({
      ...base,
      item_name: "Canon EOS M50 Camera",
      images: listingImages("Canon EOS M50 Camera"),
      category_id: electronics,
      condition: "USED",
      description:
        "Mirrorless camera with 15-45mm kit lens, great for beginners.",
      price: 310000,
      seller_id: users.bola._id,
      created_at: daysAgo(14),
    }),
  ]);

  console.log(
    `[Seed] Seeded 18 listings across ${Object.keys(categories).length} categories`,
  );

  return {
    active: [
      l1_active,
      l7_active,
      l11_active,
      l14_active,
      l15_active,
      l18_active,
    ],
    draft: l3_draft,
    cancelled: l8_cancelled,
    negotiable: l2_negotiable,
    toSell: {
      adaeze_released_1: l4_sold,
      adaeze_released_2: l5_sold,
      adaeze_disputed: l6_sold,
      chidi_released_1: l9_sold,
      chidi_receipt_confirmed: l10_sold,
      bola_released_1: l12_sold,
      bola_paid: l13_sold,
      ifeoma_refunded: l16_sold,
      bola_pending_payment: l17_sold,
    },
  };
};

const seedWishlist = async (
  users: SeedUsers,
  listings: SeedListings,
): Promise<void> => {
  await WishlistItem.create([
    { user_id: users.emeka._id, listing_id: listings.active[0]._id },
    { user_id: users.emeka._id, listing_id: listings.active[2]._id },
    { user_id: users.ngozi._id, listing_id: listings.active[1]._id },
    { user_id: users.ngozi._id, listing_id: listings.negotiable._id },
  ]);
  console.log("[Seed] Seeded 4 wishlist items");
};

const seedConversationsAndOffers = async (
  users: SeedUsers,
  listings: SeedListings,
): Promise<void> => {
  // Ongoing negotiation: Emeka offers on Adaeze's negotiable listing, Adaeze counters.
  const negotiation = await getOrCreateConversation(
    listings.negotiable._id.toString(),
    users.emeka._id.toString(),
    users.adaeze._id.toString(),
  );

  await persistMessage({
    conversation_id: negotiation._id,
    sender_id: users.emeka._id,
    message_type: "TEXT",
    body: "Hi! Is this iPhone still available?",
  });
  await persistMessage({
    conversation_id: negotiation._id,
    sender_id: users.adaeze._id,
    message_type: "TEXT",
    body: "Yes it is, still in great shape.",
  });

  const initial_offer = await Offer.create({
    listing_id: listings.negotiable._id,
    buyer_id: users.emeka._id,
    seller_id: users.adaeze._id,
    amount: 300000,
    note: "Would you accept 300k?",
    status: "COUNTERED",
    responded_at: daysAgo(1),
    created_at: daysAgo(2),
  });
  await persistMessage({
    conversation_id: negotiation._id,
    sender_id: users.emeka._id,
    message_type: "OFFER",
    body: "Offered ₦300,000 — Would you accept 300k?",
    offer_id: initial_offer._id,
  });

  const counter_offer = await Offer.create({
    listing_id: listings.negotiable._id,
    buyer_id: users.emeka._id,
    seller_id: users.adaeze._id,
    amount: 325000,
    note: "Best I can do is 325k, final price.",
    parent_offer_id: initial_offer._id,
    status: "PENDING",
    created_at: daysAgo(1),
  });
  await persistMessage({
    conversation_id: negotiation._id,
    sender_id: users.adaeze._id,
    message_type: "OFFER",
    body: "Countered with ₦325,000 — Best I can do is 325k, final price.",
    offer_id: counter_offer._id,
  });

  // A declined offer, for variety.
  await Offer.create({
    listing_id: (listings.active[3] ?? listings.active[0])._id,
    buyer_id: users.ngozi._id,
    seller_id: users.ifeoma._id,
    amount: 50000,
    note: "Would you consider 50k?",
    status: "DECLINED",
    responded_at: daysAgo(3),
    created_at: daysAgo(4),
  });

  // Plain question-and-answer conversation, unrelated to offers, with an unread message.
  const chat = await getOrCreateConversation(
    listings.active[0]._id.toString(),
    users.ngozi._id.toString(),
    users.adaeze._id.toString(),
  );
  await persistMessage({
    conversation_id: chat._id,
    sender_id: users.ngozi._id,
    message_type: "TEXT",
    body: "Does the MacBook come with the original charger?",
  });
  await persistMessage({
    conversation_id: chat._id,
    sender_id: users.adaeze._id,
    message_type: "TEXT",
    body: "Yes, original charger and box included.",
  });
  await persistMessage({
    conversation_id: chat._id,
    sender_id: users.ngozi._id,
    message_type: "TEXT",
    body: "Perfect, I'll take it. Sending payment shortly.",
  });

  console.log(
    "[Seed] Seeded 2 conversations, 4 offers (incl. an ongoing counter-offer thread), and messages",
  );
};

interface TransactionFixture {
  key: keyof SeedListings["toSell"];
  buyer: IUser;
  seller: IUser;
  finalStatus: ITransaction["status"];
}

const seedTransactionsWalletAndReviews = async (
  users: SeedUsers,
  listings: SeedListings,
): Promise<void> => {
  const fixtures: TransactionFixture[] = [
    {
      key: "adaeze_released_1",
      buyer: users.emeka,
      seller: users.adaeze,
      finalStatus: "RELEASED",
    },
    {
      key: "adaeze_released_2",
      buyer: users.ngozi,
      seller: users.adaeze,
      finalStatus: "RELEASED",
    },
    {
      key: "adaeze_disputed",
      buyer: users.ngozi,
      seller: users.adaeze,
      finalStatus: "DISPUTED",
    },
    {
      key: "chidi_released_1",
      buyer: users.emeka,
      seller: users.chidi,
      finalStatus: "RELEASED",
    },
    {
      key: "chidi_receipt_confirmed",
      buyer: users.ngozi,
      seller: users.chidi,
      finalStatus: "RECEIPT_CONFIRMED",
    },
    {
      key: "bola_released_1",
      buyer: users.ngozi,
      seller: users.bola,
      finalStatus: "RELEASED",
    },
    {
      key: "bola_paid",
      buyer: users.emeka,
      seller: users.bola,
      finalStatus: "PAID",
    },
    {
      key: "ifeoma_refunded",
      buyer: users.emeka,
      seller: users.ifeoma,
      finalStatus: "REFUNDED",
    },
    {
      key: "bola_pending_payment",
      buyer: users.ngozi,
      seller: users.bola,
      finalStatus: "PENDING_PAYMENT",
    },
  ];

  for (const [index, fixture] of fixtures.entries()) {
    const listing = listings.toSell[fixture.key];
    const created_days_ago = 25 - index * 2;

    const tx = await createTransactionForSale(
      {
        _id: listing._id,
        status: listing.status,
        seller_id: fixture.seller._id,
        price: listing.price,
      },
      fixture.buyer._id.toString(),
      listing.price,
    );

    if (fixture.finalStatus === "PENDING_PAYMENT") {
      await Transaction.findByIdAndUpdate(tx._id, {
        created_at: daysAgo(created_days_ago),
      });
      continue;
    }

    // Every non-pending fixture completed checkout — hold escrow.
    await Transaction.findByIdAndUpdate(tx._id, {
      status: "PAID",
      payment_ref: tx._id.toString(),
      created_at: daysAgo(created_days_ago),
    });
    await WalletLedgerEntry.create({
      user_id: fixture.seller._id,
      transaction_id: tx._id,
      type: "ESCROW_HOLD",
      bucket: "ESCROW",
      amount: tx.seller_amount,
      created_at: daysAgo(created_days_ago),
    });

    if (fixture.finalStatus === "PAID") continue;

    if (fixture.finalStatus === "RECEIPT_CONFIRMED") {
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "RECEIPT_CONFIRMED",
        receipt_confirmed_at: daysAgo(created_days_ago - 1),
        auto_release_at: new Date(
          Date.now() + env.AUTO_RELEASE_HOURS * 60 * 60 * 1000,
        ),
      });
      continue;
    }

    if (fixture.finalStatus === "DISPUTED") {
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "RECEIPT_CONFIRMED",
        receipt_confirmed_at: daysAgo(created_days_ago - 1),
      });
      const dispute = await Dispute.create({
        transaction_id: tx._id,
        raised_by: fixture.buyer._id,
        description:
          "Item arrived with a cracked screen that wasn't disclosed in the listing.",
        evidence_urls: [stockImage(`dispute-evidence-${tx._id.toString()}`)],
        status: "OPEN",
        created_at: daysAgo(created_days_ago - 2),
      });
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "DISPUTED",
        dispute_id: dispute._id,
      });
      continue;
    }

    if (fixture.finalStatus === "REFUNDED") {
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "RECEIPT_CONFIRMED",
        receipt_confirmed_at: daysAgo(created_days_ago - 1),
      });
      const dispute = await Dispute.create({
        transaction_id: tx._id,
        raised_by: fixture.buyer._id,
        description: "Laptop battery health was misrepresented in the listing.",
        evidence_urls: [],
        status: "RESOLVED_BUYER",
        resolution_note:
          "Seller agreed to a full refund after reviewing the evidence.",
        resolved_at: daysAgo(created_days_ago - 3),
        created_at: daysAgo(created_days_ago - 2),
      });
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "REFUNDED",
        dispute_id: dispute._id,
      });
      // Resolved-in-buyer's-favor: escrow hold is released, seller gets nothing.
      await WalletLedgerEntry.create({
        user_id: fixture.seller._id,
        transaction_id: tx._id,
        type: "ESCROW_RELEASE",
        bucket: "ESCROW",
        amount: -tx.seller_amount,
        created_at: daysAgo(created_days_ago - 3),
      });
      continue;
    }

    // RELEASED: receipt confirmed, payment released, escrow moved to available balance.
    await Transaction.findByIdAndUpdate(tx._id, {
      status: "RELEASED",
      receipt_confirmed_at: daysAgo(created_days_ago - 1),
      released_at: daysAgo(created_days_ago - 2),
    });
    await WalletLedgerEntry.create([
      {
        user_id: fixture.seller._id,
        transaction_id: tx._id,
        type: "ESCROW_RELEASE",
        bucket: "ESCROW",
        amount: -tx.seller_amount,
        created_at: daysAgo(created_days_ago - 2),
      },
      {
        user_id: fixture.seller._id,
        transaction_id: tx._id,
        type: "ESCROW_RELEASE",
        bucket: "AVAILABLE",
        amount: tx.seller_amount,
        created_at: daysAgo(created_days_ago - 2),
      },
    ]);

    await Review.create([
      {
        transaction_id: tx._id,
        reviewer_id: fixture.buyer._id,
        reviewee_id: fixture.seller._id,
        reviewer_role: "BUYER",
        rating: 5,
        comment: "Great seller, item exactly as described. Fast delivery!",
        created_at: daysAgo(created_days_ago - 3),
      },
      {
        transaction_id: tx._id,
        reviewer_id: fixture.seller._id,
        reviewee_id: fixture.buyer._id,
        reviewer_role: "SELLER",
        rating: 5,
        comment: "Smooth transaction, prompt payment. Recommended buyer.",
        created_at: daysAgo(created_days_ago - 3),
      },
    ]);
  }

  console.log(
    "[Seed] Seeded 9 transactions (all statuses), disputes, reviews, and wallet ledger entries",
  );
};

const seedWithdrawalsAndPayoutBanks = async (
  users: SeedUsers,
): Promise<void> => {
  const [adaeze_bank, chidi_bank, bola_bank] = await Promise.all([
    PayoutBank.create({
      user_id: users.adaeze._id,
      bank_name: "GTBank",
      account_number: "0123456789",
      account_name: "Adaeze Okonkwo",
      is_default: true,
    }),
    PayoutBank.create({
      user_id: users.chidi._id,
      bank_name: "Access Bank",
      account_number: "0234567891",
      account_name: "Chidi Umeh",
      is_default: true,
    }),
    PayoutBank.create({
      user_id: users.bola._id,
      bank_name: "Zenith Bank",
      account_number: "0345678912",
      account_name: "Bola Adigun",
      is_default: true,
    }),
    PayoutBank.create({
      user_id: users.ifeoma._id,
      bank_name: "UBA",
      account_number: "0456789123",
      account_name: "Ifeoma Nwosu",
      is_default: true,
    }),
  ]);

  const completed = await WithdrawalRequest.create({
    user_id: users.adaeze._id,
    amount: 200000,
    bank_name: adaeze_bank.bank_name,
    account_number: adaeze_bank.account_number,
    account_name: adaeze_bank.account_name,
    status: "COMPLETED",
    created_at: daysAgo(10),
  });
  await WalletLedgerEntry.create({
    user_id: users.adaeze._id,
    withdrawal_id: completed._id,
    type: "WITHDRAWAL_HOLD",
    bucket: "AVAILABLE",
    amount: -200000,
    created_at: daysAgo(10),
  });

  const pending = await WithdrawalRequest.create({
    user_id: users.chidi._id,
    amount: 100000,
    bank_name: chidi_bank.bank_name,
    account_number: chidi_bank.account_number,
    account_name: chidi_bank.account_name,
    status: "PENDING",
    created_at: daysAgo(1),
  });
  await WalletLedgerEntry.create({
    user_id: users.chidi._id,
    withdrawal_id: pending._id,
    type: "WITHDRAWAL_HOLD",
    bucket: "AVAILABLE",
    amount: -100000,
    created_at: daysAgo(1),
  });

  const rejected = await WithdrawalRequest.create({
    user_id: users.bola._id,
    amount: 50000,
    bank_name: bola_bank.bank_name,
    account_number: bola_bank.account_number,
    account_name: bola_bank.account_name,
    status: "REJECTED",
    created_at: daysAgo(6),
  });
  await WalletLedgerEntry.create([
    {
      user_id: users.bola._id,
      withdrawal_id: rejected._id,
      type: "WITHDRAWAL_HOLD",
      bucket: "AVAILABLE",
      amount: -50000,
      created_at: daysAgo(6),
    },
    {
      user_id: users.bola._id,
      withdrawal_id: rejected._id,
      type: "WITHDRAWAL_REVERSAL",
      bucket: "AVAILABLE",
      amount: 50000,
      created_at: daysAgo(5),
    },
  ]);

  console.log(
    "[Seed] Seeded 4 payout banks and 3 withdrawal requests (completed/pending/rejected)",
  );
};

const seedNotifications = async (users: SeedUsers): Promise<void> => {
  const entries: {
    user_id: Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    created_days_ago: number;
  }[] = [
    {
      user_id: users.adaeze._id,
      type: "OFFER_RECEIVED",
      title: "New offer received",
      body: 'Emeka offered ₦300,000 for "iPhone 13 Pro 128GB"',
      read: true,
      created_days_ago: 2,
    },
    {
      user_id: users.adaeze._id,
      type: "PAYMENT_RECEIVED",
      title: "Payment received",
      body: 'Payment for "Samsung Galaxy S22 Ultra" is held in escrow. Ship the item to get paid.',
      read: true,
      created_days_ago: 19,
    },
    {
      user_id: users.adaeze._id,
      type: "RECEIPT_CONFIRMED",
      title: "Buyer confirmed receipt",
      body: 'The buyer confirmed receipt of "Samsung Galaxy S22 Ultra".',
      read: true,
      created_days_ago: 18,
    },
    {
      user_id: users.adaeze._id,
      type: "PAYMENT_RELEASED",
      title: "Payment released",
      body: "₦494,000 has been released to you",
      read: false,
      created_days_ago: 17,
    },
    {
      user_id: users.adaeze._id,
      type: "DISPUTE_RAISED",
      title: "Dispute raised",
      body: 'A dispute was raised on "iPad Air 5th Gen". Payment is held until resolved.',
      read: false,
      created_days_ago: 3,
    },
    {
      user_id: users.adaeze._id,
      type: "REVIEW_RECEIVED",
      title: "New review received",
      body: "You received a 5-star review",
      read: false,
      created_days_ago: 6,
    },
    {
      user_id: users.adaeze._id,
      type: "SELLER_VERIFIED",
      title: "You're now a verified seller!",
      body: "Congratulations! Your seller verification request has been approved.",
      read: true,
      created_days_ago: 100,
    },
    {
      user_id: users.adaeze._id,
      type: "WITHDRAWAL_UPDATE",
      title: "Withdrawal completed",
      body: "Your withdrawal of ₦200,000 has been sent to your bank account.",
      read: true,
      created_days_ago: 10,
    },
    {
      user_id: users.emeka._id,
      type: "OFFER_COUNTERED",
      title: "Seller countered your offer",
      body: 'The seller countered with ₦325,000 on "iPhone 13 Pro 128GB"',
      read: false,
      created_days_ago: 1,
    },
    {
      user_id: users.emeka._id,
      type: "PAYMENT_REVERSED",
      title: "Payment reversed",
      body: 'Your payment for "Dell XPS 13 Laptop" was reversed. The transaction has been cancelled.',
      read: false,
      created_days_ago: 3,
    },
    {
      user_id: users.emeka._id,
      type: "NEW_MESSAGE",
      title: "New message",
      body: "Yes it is, still in great shape.",
      read: true,
      created_days_ago: 2,
    },
    {
      user_id: users.ngozi._id,
      type: "OFFER_DECLINED",
      title: "Offer declined",
      body: 'Your offer on "PlayStation 5 Console" was declined',
      read: false,
      created_days_ago: 3,
    },
    {
      user_id: users.ngozi._id,
      type: "CATEGORY_REQUEST_APPROVED",
      title: 'Your category request "Sporting Goods" was approved',
      body: 'Good news! The category "Sporting Goods" you requested is now available.',
      read: false,
      created_days_ago: 4,
    },
    {
      user_id: users.chidi._id,
      type: "DISPUTE_RESOLVED",
      title: "Dispute resolved",
      body: 'The dispute on "Dell XPS 13 Laptop" has been resolved',
      read: true,
      created_days_ago: 22,
    },
  ];

  await Notification.create(
    entries.map((e) => ({
      user_id: e.user_id,
      type: e.type,
      title: e.title,
      body: e.body,
      read_at: e.read ? daysAgo(e.created_days_ago - 1) : null,
      created_at: daysAgo(e.created_days_ago),
    })),
  );

  console.log(
    `[Seed] Seeded ${entries.length} notifications across ${new Set(entries.map((e) => e.type)).size} types`,
  );
};

const seedCategoryRequests = async (
  users: SeedUsers,
  categories: Record<string, ICategory>,
): Promise<void> => {
  const sporting_goods = await Category.findOneAndUpdate(
    { slug: "sporting-goods" },
    {
      name: "Sporting Goods",
      slug: "sporting-goods",
      image: null,
      is_active: true,
      requested_by: users.emeka._id,
    },
    { upsert: true, new: true },
  );

  await CategoryRequest.create([
    {
      requested_by: users.ngozi._id,
      name: "Books & Stationery",
      reason:
        "I have a lot of textbooks and school supplies to sell every semester.",
      status: "PENDING",
      created_at: daysAgo(2),
    },
    {
      requested_by: users.emeka._id,
      name: "Sporting Goods",
      reason: "Selling used gym equipment and sports gear.",
      status: "APPROVED",
      resolved_category_id: sporting_goods._id,
      created_at: daysAgo(6),
    },
    {
      requested_by: users.ifeoma._id,
      name: "Luxury Watches",
      reason: "Want a dedicated category for high-end watches.",
      status: "REJECTED",
      rejection_notified: true,
      created_at: daysAgo(15),
    },
  ]);

  categories["sporting-goods"] = sporting_goods;
  console.log(
    "[Seed] Seeded 1 dynamically-approved category and 3 category requests (pending/approved/rejected)",
  );
};

const seedContactMessages = async (): Promise<void> => {
  await ContactMessage.create([
    {
      name: "Wale Adeyemi",
      email: "wale.adeyemi@example.com",
      subject: "Question about escrow release time",
      message:
        "How long does it take for funds to be released after I confirm receipt?",
      emailed: true,
      created_at: daysAgo(4),
    },
    {
      name: "Funmi Bello",
      email: "funmi.bello@example.com",
      subject: "Unable to upload listing images",
      message:
        "I keep getting an error when trying to upload more than 2 images to my listing.",
      emailed: false,
      created_at: daysAgo(1),
    },
  ]);
  console.log("[Seed] Seeded 2 contact messages");
};

const seedOtpAndReminders = async (users: SeedUsers): Promise<void> => {
  await Otp.create({
    user_id: users.tunde._id,
    code: "482913",
    purpose: "SIGNUP",
    expires_at: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
    used: false,
  });
  await Otp.create({
    user_id: users.adaeze._id,
    code: "119284",
    purpose: "PASSWORD_RESET",
    expires_at: daysAgo(59),
    used: true,
    created_at: daysAgo(60),
  });
  await VerificationReminder.create({ user_id: users.tunde._id, type: "1h" });

  console.log("[Seed] Seeded 2 OTPs and 1 verification reminder");
};

const main = async (): Promise<void> => {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run the seed script against a production environment (NODE_ENV=production)",
    );
  }

  await connectDB();
  console.log("[Seed] Connected to MongoDB");

  await wipeSeedData();

  const categories = await seedCategories();
  const users = await seedUsers();
  const listings = await seedListings(users, categories);

  await seedWishlist(users, listings);
  await seedConversationsAndOffers(users, listings);
  await seedTransactionsWalletAndReviews(users, listings);
  await seedWithdrawalsAndPayoutBanks(users);
  await seedNotifications(users);
  await seedCategoryRequests(users, categories);
  await seedContactMessages();
  await seedOtpAndReminders(users);

  console.log(
    "\n[Seed] Done! Log in with any seeded account using password:",
    SEED_PASSWORD,
  );
  console.log(
    "[Seed] Sellers: adaeze.seller@tradeng.dev, chidi.seller@tradeng.dev, bola.seller@tradeng.dev, ifeoma.seller@tradeng.dev",
  );
  console.log(
    "[Seed] Buyers: emeka.buyer@tradeng.dev, ngozi.buyer@tradeng.dev",
  );
  console.log(
    "[Seed] Edge cases: tunde.unverified@tradeng.dev (unverified), grace.suspended@tradeng.dev (suspended)",
  );

  await disconnectDB();
};

main().catch(async (err) => {
  console.error("[Seed] Failed:", err);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
