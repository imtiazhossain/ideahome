import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useProjectSearch } from "../../lib/useProjectSearch";
import { IconSearch } from "../icons";

interface ProjectNavSearchProps {
  projectId?: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange?: (value: string) => void;
  projectSearchOpen: boolean;
  setProjectSearchOpen: (open: boolean) => void;
}

export function ProjectNavSearch({
  projectId,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  projectSearchOpen,
  setProjectSearchOpen,
}: ProjectNavSearchProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const {
    results: projectSearchResults,
    setResults: setProjectSearchResults,
    loading: projectSearchLoading,
  } = useProjectSearch(projectId, projectSearchQuery);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectSearchRef.current &&
        !projectSearchRef.current.contains(e.target as Node)
      ) {
        setProjectSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setProjectSearchOpen]);

  return (
    <div
      className={`project-nav-search-wrap${
        mobileSearchOpen ? " is-mobile-search-open" : ""
      }`}
      ref={projectSearchRef}
      style={projectId ? { position: "relative" } : undefined}
    >
      <button
        type="button"
        className="project-nav-search-icon"
        aria-label="Open search"
        onClick={() => {
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1024px)").matches
          ) {
            setMobileSearchOpen(true);
            requestAnimationFrame(() => projectSearchInputRef.current?.focus());
            return;
          }
          projectSearchInputRef.current?.focus();
        }}
      >
        <IconSearch />
      </button>
      <input
        ref={projectSearchInputRef}
        type="search"
        id="project-nav-search-input"
        className="project-nav-search"
        placeholder={
          projectId
            ? "A little light to find things in the dark..."
            : searchPlaceholder
        }
        value={projectId ? projectSearchQuery : searchValue}
        onChange={(e) => {
          if (projectId) {
            const v = e.target.value;
            setProjectSearchQuery(v);
            setProjectSearchOpen(!!v.trim());
          } else {
            onSearchChange?.(e.target.value);
          }
        }}
        onFocus={() => {
          setMobileSearchOpen(true);
          if (projectId && projectSearchQuery.trim()) {
            setProjectSearchOpen(true);
          }
        }}
        onBlur={() => {
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1024px)").matches &&
            !(projectId ? projectSearchQuery.trim() : searchValue.trim())
          ) {
            setMobileSearchOpen(false);
          }
        }}
        aria-label="Search"
        aria-expanded={
          projectId
            ? projectSearchOpen && projectSearchResults.length > 0
            : undefined
        }
        aria-controls={projectId ? "project-search-results" : undefined}
        aria-autocomplete={projectId ? "list" : undefined}
      />
      {projectId &&
        projectSearchOpen &&
        (projectSearchResults.length > 0 || projectSearchLoading) && (
          <ul
            id="project-search-results"
            className="project-nav-search-results"
            role="listbox"
            aria-label="Search results"
          >
            {projectSearchLoading ? (
              <li
                className="project-nav-search-results-loading"
                role="option"
                aria-selected={false}
              >
                Searching…
              </li>
            ) : (
              projectSearchResults.map((item) => {
                const key =
                  item.type === "issue"
                    ? `issue-${item.id}`
                    : `list-${item.page}-${item.id}`;
                const href =
                  item.type === "issue"
                    ? `/?issueId=${encodeURIComponent(item.id)}`
                    : `${item.page}?projectId=${encodeURIComponent(
                        item.projectId
                      )}`;
                const title = item.type === "issue" ? item.title : item.name;
                const meta =
                  item.type === "issue" ? item.status : item.pageLabel;
                return (
                  <li key={key} role="option">
                    <Link
                      href={href}
                      prefetch={false}
                      className="project-nav-search-result-item"
                      onClick={() => {
                        setProjectSearchOpen(false);
                        setProjectSearchQuery("");
                        setProjectSearchResults([]);
                      }}
                    >
                      <span className="project-nav-search-result-title">
                        {title}
                      </span>
                      {meta && (
                        <span className="project-nav-search-result-meta">
                          {meta}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        )}
    </div>
  );
}
