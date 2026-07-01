import type { UserStatus } from "@/models/v1/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        status: UserStatus;
      };
    }
  }
}
