import { app } from "./app";
import { env } from "./shared/config/env";

app.listen(env.PORT, () => {
  console.log(`Servidor rodando em http://localhost:${env.PORT}`);
});
