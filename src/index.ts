import dotenv from "dotenv";
import { app } from "./app";
import express from "express";

dotenv.config();

app.use(express.json());

/**
 * Routes need to be loaded once middlewares are added
 */
import "./routes";

const port = process.env.SERVER_PORT || 3000;

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
