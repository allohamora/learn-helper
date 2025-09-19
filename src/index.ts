import { NODE_ENV } from "./config.js";
import { createLogger } from "./libs/pino.lib.js";

const logger = createLogger("main");

logger.info({ msg: "hello-world!", NODE_ENV });
