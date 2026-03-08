import type { NextApiRequest, NextApiResponse } from "next";
import { readCodexPromptUsage } from "../../lib/server/codexPromptUsage";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const payload = await readCodexPromptUsage();
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to read Codex prompt usage.",
    });
  }
}
