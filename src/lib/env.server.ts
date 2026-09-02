/**
 * Reads a runtime secret from every place the edge runtime may expose it.
 * process.env is not always populated inside the Worker, so we also check
 * the Cloudflare `env` binding and any globals the platform sets.
 */
export async function readEnv(name: string): Promise<string> {
  const fromProcess =
    typeof process !== "undefined" ? (process.env?.[name] ?? "") : "";
  if (fromProcess) return fromProcess;

  try {
    const specifier = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      env?: Record<string, string | undefined>;
    };
    const value = mod?.env?.[name];
    if (value) return value;
  } catch {
    // Not running on Cloudflare — ignore.
  }

  const globalEnv = (globalThis as unknown as {
    env?: Record<string, string | undefined>;
    __env__?: Record<string, string | undefined>;
  });
  return globalEnv.env?.[name] ?? globalEnv.__env__?.[name] ?? "";
}
