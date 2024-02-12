import dotenv from "dotenv";
import { app } from "./app";
import "./routes";

dotenv.config();

const port = process.env.SERVER_PORT || 3000;

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
