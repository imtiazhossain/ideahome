import React, { type RefObject } from "react";
import { getIssueFileUrl } from "../../lib/api/media";
import { ErrorBanner } from "../../components/ErrorBanner";
import { IconDownload } from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";

export type IssueDetailModalFilesProps = {
  issueId: string;
  files: Array<{ id: string; fileName: string }>;
  filesSectionRef: RefObject<HTMLDivElement>;
  handleDeleteFile: (id: string) => void;
  uploadButtonBusy: boolean;
  fileUploading: boolean;
  fileError: string | null;
  setFileError: (v: string | null) => void;
  dragOverCount: number;
};

export function IssueDetailModalFiles({
  issueId,
  files,
  filesSectionRef,
  handleDeleteFile,
  uploadButtonBusy,
  fileUploading,
  fileError,
  setFileError,
  dragOverCount,
}: IssueDetailModalFilesProps) {
  return (
    <div className="form-group" ref={filesSectionRef}>
      <label>
        Files
        {files.length > 0 ? ` (${files.length})` : ""}
      </label>
      <div className="recording-section">
        {files.length > 0 && (
          <ul
            style={{ listStyle: "none", margin: 0, padding: 0 }}
            className="issue-file-list"
          >
            {files.map((f) => {
              const displayName = f.fileName;
              return (
                <li
                  key={f.id}
                  className="issue-file-row"
                  data-file-id={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <a
                    href={getIssueFileUrl(issueId, f.id)}
                    download={f.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="issue-file-link text-sm"
                    style={{ flexShrink: 0 }}
                    aria-label={`Download ${displayName}`}
                  >
                    <IconDownload size={14} />
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm btn-icon"
                    onClick={() => handleDeleteFile(f.id)}
                    aria-label={`Delete ${displayName}`}
                    title={`Delete ${displayName}`}
                  >
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {(uploadButtonBusy || fileUploading) && (
          <div
            className="recording-uploading file-uploading-with-spinner"
            role="status"
            aria-live="polite"
          >
            <span className="upload-spinner" aria-hidden="true" />
            <span>Uploading file…</span>
          </div>
        )}
        {fileError && (
          <ErrorBanner
            message={fileError}
            onDismiss={() => setFileError(null)}
            style={{ marginTop: 8 }}
          />
        )}
        {dragOverCount > 0 && (
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Drop files here — images go to Screenshots, video/audio to
            Recordings, others (e.g. PDF) to Files.
          </p>
        )}
      </div>
    </div>
  );
}
