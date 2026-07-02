import emailjs from "@emailjs/nodejs";
import { env } from "@/config/env";

emailjs.init({
  publicKey: env.EMAILJS_PUBLIC_KEY,
  privateKey: env.EMAILJS_PRIVATE_KEY,
});

export { emailjs };
