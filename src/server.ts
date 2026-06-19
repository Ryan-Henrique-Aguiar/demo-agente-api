import "dotenv/config";
import { createApp } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 API da demo Leucotron rodando em http://localhost:${PORT}`);
  console.log(`   Healthcheck: http://localhost:${PORT}/health`);
});
