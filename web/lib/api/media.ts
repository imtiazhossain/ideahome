import type {
  IssueFile as SharedIssueFile,
  IssueRecording as SharedIssueRecording,
  IssueScreenshot as SharedIssueScreenshot,
} from "@ideahome/shared";

export type IssueRecording = SharedIssueRecording;
export type IssueScreenshot = SharedIssueScreenshot;
export type IssueFile = SharedIssueFile;

export {
  uploadIssueRecording,
  updateIssueRecording,
  deleteIssueRecording,
  getRecordingUrl,
  uploadIssueScreenshot,
  updateIssueScreenshot,
  deleteIssueScreenshot,
  getScreenshotUrl,
  uploadIssueFile,
  deleteIssueFile,
  getIssueFileUrl,
} from "./issueMedia";
