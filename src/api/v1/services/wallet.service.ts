import { Types } from "mongoose";
import {
  WalletLedgerEntry,
  LedgerEntryType,
  LedgerBucket,
} from "@/models/v1/wallet_ledger_entry.model";

interface CreateLedgerEntryParams {
  user_id: string | Types.ObjectId;
  transaction_id?: string | Types.ObjectId | null;
  withdrawal_id?: string | Types.ObjectId | null;
  type: LedgerEntryType;
  bucket: LedgerBucket;
  amount: number;
}

export const createLedgerEntry = async (
  params: CreateLedgerEntryParams,
): Promise<void> => {
  await WalletLedgerEntry.create({
    user_id: params.user_id,
    transaction_id: params.transaction_id ?? null,
    withdrawal_id: params.withdrawal_id ?? null,
    type: params.type,
    bucket: params.bucket,
    amount: params.amount,
  });
};

export const recordEscrowHold = (
  user_id: string | Types.ObjectId,
  transaction_id: string | Types.ObjectId,
  amount: number,
) =>
  createLedgerEntry({
    user_id,
    transaction_id,
    type: "ESCROW_HOLD",
    bucket: "ESCROW",
    amount,
  });

export const recordEscrowRelease = async (
  user_id: string | Types.ObjectId,
  transaction_id: string | Types.ObjectId,
  amount: number,
): Promise<void> => {
  await createLedgerEntry({
    user_id,
    transaction_id,
    type: "ESCROW_RELEASE",
    bucket: "ESCROW",
    amount: -amount,
  });
  await createLedgerEntry({
    user_id,
    transaction_id,
    type: "ESCROW_RELEASE",
    bucket: "AVAILABLE",
    amount,
  });
};

export const recordEscrowReversal = (
  user_id: string | Types.ObjectId,
  transaction_id: string | Types.ObjectId,
  amount: number,
) =>
  createLedgerEntry({
    user_id,
    transaction_id,
    type: "ESCROW_RELEASE",
    bucket: "ESCROW",
    amount: -amount,
  });

export const recordWithdrawalHold = (
  user_id: string | Types.ObjectId,
  withdrawal_id: string | Types.ObjectId,
  amount: number,
) =>
  createLedgerEntry({
    user_id,
    withdrawal_id,
    type: "WITHDRAWAL_HOLD",
    bucket: "AVAILABLE",
    amount: -amount,
  });

export const recordWithdrawalReversal = (
  user_id: string | Types.ObjectId,
  withdrawal_id: string | Types.ObjectId,
  amount: number,
) =>
  createLedgerEntry({
    user_id,
    withdrawal_id,
    type: "WITHDRAWAL_REVERSAL",
    bucket: "AVAILABLE",
    amount,
  });

interface WalletBalances {
  available_balance: number;
  escrow_balance: number;
}

export const getWalletBalances = async (
  user_id: string,
): Promise<WalletBalances> => {
  const results = await WalletLedgerEntry.aggregate<{
    _id: LedgerBucket;
    total: number;
  }>([
    { $match: { user_id: new Types.ObjectId(user_id) } },
    { $group: { _id: "$bucket", total: { $sum: "$amount" } } },
  ]);

  const totals = Object.fromEntries(
    results.map((r) => [r._id, r.total]),
  ) as Record<LedgerBucket, number>;

  return {
    available_balance: parseFloat((totals.AVAILABLE ?? 0).toFixed(2)),
    escrow_balance: parseFloat((totals.ESCROW ?? 0).toFixed(2)),
  };
};
