import type { NextApiRequest, NextApiResponse } from "next";

export default async function backendServerlessStub(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(404).json({ error: "Built-in API is disabled" });
}
