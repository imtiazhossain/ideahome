import { useRouter } from "next/router";
import { CheckableListPage } from "../components/CheckableListPage";
import type { CheckableListPageKey } from "../config/checkableListPages";

const VALID_TYPES: CheckableListPageKey[] = [
  "features",
  "todo",
  "bugs",
  "ideas",
  "enhancements",
];

export default function CheckableListTypePage() {
  const router = useRouter();
  const type = typeof router.query.type === "string" ? router.query.type : "";

  if (!router.isReady) return null;

  if (!VALID_TYPES.includes(type as CheckableListPageKey)) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <div style={{ padding: 24 }}>
            <h1>Page Not Found</h1>
            <p>The page &quot;{type || "(empty)"}&quot; does not exist.</p>
            <a href="/">Go home</a>
          </div>
        </main>
      </div>
    );
  }

  return <CheckableListPage pageKey={type as CheckableListPageKey} />;
}
