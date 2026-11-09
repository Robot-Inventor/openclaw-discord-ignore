import { execFileSync } from "node:child_process";
import packageJson from "../package.json" with { type: "json" };
import process from "node:process";

const REQUEST_TIMEOUT_MS = 15_000;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

const { name, version } = packageJson;
const response = await fetch(
    `https://clawhub.ai/api/v1/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
    {
        headers: process.env["CLAWHUB_TOKEN"]
            ? {
                  Authorization: `Bearer ${process.env["CLAWHUB_TOKEN"]}`
              }
            : {},
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
);

if (response.status === HTTP_OK) {
    process.stdout.write(`${name}@${version} is already published to ClawHub. Skipping.\n`);
} else if (response.status === HTTP_NOT_FOUND) {
    execFileSync("node", ["node_modules/clawhub/bin/clawdhub.js", "package", "publish", "."], { stdio: "inherit" });
} else {
    throw new Error(
        `Failed to check ${name}@${version} on ClawHub: HTTP ${response.status.toString()} ${response.statusText}`
    );
}
