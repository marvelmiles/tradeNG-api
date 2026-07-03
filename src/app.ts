import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import routes from "@/routes/index";
import { errorHandler } from "@/api/v1/middleware/errorHandler";
import { sendError } from "@/utils/response";

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.disable("x-powered-by");

app.use("/api", routes);

app.use((_req: Request, res: Response) => {
  sendError({ res, message: "Route not found", code: 404 });
});

app.use(
  errorHandler as (err: unknown, req: Request, res: Response, next: NextFunction) => void
);

export default app;
