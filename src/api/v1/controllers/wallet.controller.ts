import { Request, Response } from "express";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { PayoutBank } from "@/models/v1/payout_bank.model";
import { WithdrawalRequest } from "@/models/v1/withdrawal_request.model";
import { WalletLedgerEntry } from "@/models/v1/wallet_ledger_entry.model";
import { getWalletBalances, recordWithdrawalHold } from "@/api/v1/services/wallet.service";
import type { AddPayoutBankInput, CreateWithdrawalInput } from "@/api/v1/validators/wallet";

const formatPayoutBank = (bank: { _id: { toString(): string }; bank_name: string; account_number: string; account_name: string; is_default: boolean }) => ({
  id: bank._id.toString(),
  bank_name: bank.bank_name,
  account_number: bank.account_number,
  account_name: bank.account_name,
  is_default: bank.is_default,
});

const formatWithdrawal = (withdrawal: {
  _id: { toString(): string };
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: Date;
}) => ({
  id: withdrawal._id.toString(),
  amount: withdrawal.amount,
  bank_name: withdrawal.bank_name,
  account_number: withdrawal.account_number,
  account_name: withdrawal.account_name,
  status: withdrawal.status,
  created_at: withdrawal.created_at,
});

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const balances = await getWalletBalances(req.user!.id);

  return sendSuccess({ res, data: { wallet: balances } });
});

export const getWalletLedger = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { user_id: req.user!.id };

  if (pagination.pagination_type === "cursor") {
    const items = await WalletLedgerEntry.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { ledger: items.slice(0, pagination.limit).map((e) => ({ id: e._id.toString(), type: e.type, bucket: e.bucket, amount: e.amount, created_at: e.created_at })) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    WalletLedgerEntry.find(where).sort({ _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    WalletLedgerEntry.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { ledger: items.map((e) => ({ id: e._id.toString(), type: e.type, bucket: e.bucket, amount: e.amount, created_at: e.created_at })) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const addPayoutBank = asyncHandler(async (req: Request, res: Response) => {
  const { bank_name, account_number, account_name } = req.body as AddPayoutBankInput;
  const user_id = req.user!.id;

  const existing_count = await PayoutBank.countDocuments({ user_id });

  const bank = await PayoutBank.create({
    user_id,
    bank_name,
    account_number,
    account_name,
    is_default: existing_count === 0,
  });

  return sendSuccess({
    res,
    code: 201,
    message: "Payout bank added",
    data: { payout_bank: formatPayoutBank(bank) },
  });
});

export const getPayoutBanks = asyncHandler(async (req: Request, res: Response) => {
  const banks = await PayoutBank.find({ user_id: req.user!.id }).sort({ is_default: -1, created_at: -1 }).lean();

  return sendSuccess({ res, data: { payout_banks: banks.map(formatPayoutBank) } });
});

export const deletePayoutBank = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const bank = await PayoutBank.findOne({ _id: id, user_id: req.user!.id }).lean();
  if (!bank) throw new AppError("Payout bank not found", 404);

  await PayoutBank.deleteOne({ _id: id });

  return sendSuccess({ res, message: "Payout bank removed" });
});

export const createWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const { amount, payout_bank_id } = req.body as CreateWithdrawalInput;
  const user_id = req.user!.id;

  if (amount < env.WITHDRAWAL_MIN_AMOUNT) {
    throw new AppError(`Minimum withdrawal amount is ₦${env.WITHDRAWAL_MIN_AMOUNT.toLocaleString()}`, 400);
  }

  const bank = await PayoutBank.findOne({ _id: payout_bank_id, user_id }).lean();
  if (!bank) throw new AppError("Payout bank not found", 404);

  const { available_balance } = await getWalletBalances(user_id);
  if (amount > available_balance) throw new AppError("Insufficient available balance", 400);

  const withdrawal = await WithdrawalRequest.create({
    user_id,
    amount,
    bank_name: bank.bank_name,
    account_number: bank.account_number,
    account_name: bank.account_name,
  });

  await recordWithdrawalHold(user_id, withdrawal._id, amount);

  return sendSuccess({
    res,
    code: 201,
    message: "Withdrawal request submitted",
    data: { withdrawal: formatWithdrawal(withdrawal) },
  });
});

export const getWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { user_id: req.user!.id };

  if (pagination.pagination_type === "cursor") {
    const items = await WithdrawalRequest.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { withdrawals: items.slice(0, pagination.limit).map(formatWithdrawal) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    WithdrawalRequest.find(where).sort({ _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    WithdrawalRequest.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { withdrawals: items.map(formatWithdrawal) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});
