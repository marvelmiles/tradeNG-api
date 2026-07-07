import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  getWallet,
  getWalletLedger,
  addPayoutBank,
  getPayoutBanks,
  updatePayoutBank,
  deletePayoutBank,
  createWithdrawal,
  getWithdrawals,
  cancelWithdrawal,
} from "@/api/v1/controllers/wallet.controller";
import { addPayoutBankSchema, updatePayoutBankSchema, createWithdrawalSchema } from "@/api/v1/validators/wallet";

const router = Router();

router.get("/", requireAuth, getWallet);
router.get("/ledger", requireAuth, getWalletLedger);

router.get("/payout-banks", requireAuth, getPayoutBanks);
router.post("/payout-banks", requireAuth, validate(addPayoutBankSchema), addPayoutBank);
router.patch("/payout-banks/:id", requireAuth, validate(updatePayoutBankSchema), updatePayoutBank);
router.delete("/payout-banks/:id", requireAuth, deletePayoutBank);

router.get("/withdrawals", requireAuth, getWithdrawals);
router.post("/withdrawals", requireAuth, validate(createWithdrawalSchema), createWithdrawal);
router.patch("/withdrawals/:id/cancel", requireAuth, cancelWithdrawal);

export default router;
