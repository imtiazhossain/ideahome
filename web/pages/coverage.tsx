import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Redirect legacy /coverage URL to Code page (Code Health is now a section there).
 */
export default function CoveragePage() {
  const router = useRouter();
  useEffect(() => {
    void router.replace("/code");
  }, [router]);
  return null;
}
