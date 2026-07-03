import { z } from "zod";

export const addPayoutBankSchema = z.object({
  bank_name: z.string().min(2).max(100),
  account_number: z.string().min(10).max(10),
  account_name: z.string().min(2).max(100),
});

export const createWithdrawalSchema = z.object({
  amount: z.number().positive("Withdrawal amount must be greater than 0"),
  payout_bank_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid payout bank id"),
});

export type AddPayoutBankInput = z.infer<typeof addPayoutBankSchema>;
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
