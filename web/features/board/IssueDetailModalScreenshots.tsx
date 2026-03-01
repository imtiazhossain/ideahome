import React, { type RefObject } from "react";
import { getScreenshotUrl, type IssueScreenshot } from "../../lib/api/media";
import { ErrorBanner } from "../../components/ErrorBanner";
import { IconScreenshot } from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";

export type IssueDetailModalScreenshotsProps = {
  screenshots: IssueScreenshot[];
  screenshotNameFromComments: Map<string, string>;
  editingScreenshotId: string | null;
  editingScreenshotName: string;
  setEditingScreenshotId: (v: string | null) => void;
  setEditingScreenshotName: (v: string) => void;
  handleSaveScreenshotName: (id: string, name: string) => void;
  handleDeleteScreenshot: (id: string) => void;
  handleTakeScreenshot: () => void;
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  screenshotFileInputRef: RefObject<HTMLInputElement>;
  canScreenRecord: boolean;
  screenshotTaking: boolean;
  screenshotUploading: boolean;
  screenshotError: string | null;
  setScreenshotError: (v: string | null) => void;
  screenshotsSectionRef: RefObject<HTMLDivElement>;
};

export function IssueDetailModalScreenshots({
  screenshots,
  screenshotNameFromComments,
  editingScreenshotId,
  editingScreenshotName,
  setEditingScreenshotId,
  setEditingScreenshotName,
  handleSaveScreenshotName,
  handleDeleteScreenshot,
  handleTakeScreenshot,
  handleScreenshotUpload,
  screenshotFileInputRef,
  canScreenRecord,
  screenshotTaking,
  screenshotUploading,
  screenshotError,
  setScreenshotError,
  screenshotsSectionRef,
}: IssueDetailModalScreenshotsProps) {
  return (
    <div className="form-group" ref={screenshotsSectionRef}>
      <label>
        Screenshots
        {screenshots.length > 0 ? ` (${screenshots.length})` : ""}
      </label>
      <div className="recording-section">
        {screenshots.length > 0 && (
          <div
            className="screenshots-list"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 8,
            }}
          >
            {screenshots.map((shot: IssueScreenshot, shotIdx: number) => {
              const displayName =
                shot.name ??
                screenshotNameFromComments.get(shot.id) ??
                `Screenshot ${shotIdx + 1}`;
              const isEditingScreenshotName = editingScreenshotId === shot.id;
              return (
                <div
                  key={shot.id}
                  className="screenshot-item"
                  data-screenshot-id={shot.id}
                  style={{ position: "relative" }}
                >
                  <a
                    href={getScreenshotUrl(shot.imageUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block" }}
                  >
                    <img
                      src={getScreenshotUrl(shot.imageUrl)}
                      alt={
                        isEditingScreenshotName
                          ? editingScreenshotName
                          : displayName
                      }
                      style={{
                        maxWidth: 160,
                        maxHeight: 120,
                        objectFit: "contain",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    />
                  </a>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      maxWidth: isEditingScreenshotName ? 400 : 160,
                      minWidth: isEditingScreenshotName ? 160 : undefined,
                    }}
                  >
                    {isEditingScreenshotName ? (
                      <input
                        type="text"
                        value={editingScreenshotName}
                        onChange={(e) =>
                          setEditingScreenshotName(e.target.value)
                        }
                        onFocus={(e) => {
                          const input = e.currentTarget;
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() =>
                              input.setSelectionRange(0, 0)
                            );
                          });
                        }}
                        onBlur={() =>
                          handleSaveScreenshotName(
                            shot.id,
                            editingScreenshotName
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          else if (e.key === "Escape") {
                            setEditingScreenshotId(null);
                            setEditingScreenshotName("");
                          }
                        }}
                        autoFocus
                        aria-label="Screenshot name"
                        style={{
                          width: `${Math.min(400, Math.max(160, editingScreenshotName.length * 8 + 24))}px`,
                          padding: "2px 6px",
                          fontSize: 12,
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setEditingScreenshotId(shot.id);
                          setEditingScreenshotName(displayName);
                        }}
                        title="Click to edit name"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingScreenshotId(shot.id);
                            setEditingScreenshotName(displayName);
                          }
                        }}
                      >
                        {displayName}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon screenshot-item-delete"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      minWidth: 28,
                      padding: "4px 6px",
                    }}
                    onClick={() => handleDeleteScreenshot(shot.id)}
                    aria-label="Delete screenshot"
                    title="Delete screenshot"
                  >
                    <IconTrash />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!screenshotUploading && !screenshotTaking && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTakeScreenshot}
              disabled={!canScreenRecord}
            >
              <IconScreenshot size={14} /> Take Screenshot
            </button>
            <input
              ref={screenshotFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleScreenshotUpload}
              aria-label="Choose screenshot image"
            />
          </>
        )}
        {(screenshotUploading || screenshotTaking) && (
          <div className="recording-uploading">
            {screenshotTaking
              ? "Capturing screen…"
              : "Uploading screenshot…"}
          </div>
        )}
        {screenshotError && (
          <ErrorBanner
            message={screenshotError}
            onDismiss={() => setScreenshotError(null)}
            style={{ marginTop: 8 }}
          />
        )}
      </div>
    </div>
  );
}
