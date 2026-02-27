import React from "react";
import { IconMic, IconPlay, IconStop } from "./icons";

export type AssistantPlaybackStatus = "idle" | "playing" | "paused";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

interface IdeaAssistantPanelProps {
  messages: AssistantChatMessage[];
  gifUrl?: string;
  loading: boolean;
  recording: boolean;
  voiceRepliesEnabled: boolean;
  playbackStatus: AssistantPlaybackStatus;
  loadingStatus: string;
  inputValue: string;
  isMobileAssistantComposer: boolean;
  isCollapsed: boolean;
  onThreadRef: (node: HTMLDivElement | null) => void;
  onInputRef: (node: HTMLTextAreaElement | null) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleVoiceRecording: () => void;
  onVoiceReplyControl: () => void;
}

export function IdeaAssistantPanel({
  messages,
  gifUrl,
  loading,
  recording,
  voiceRepliesEnabled,
  playbackStatus,
  loadingStatus,
  inputValue,
  isMobileAssistantComposer,
  isCollapsed,
  onThreadRef,
  onInputRef,
  onInputChange,
  onSend,
  onToggleVoiceRecording,
  onVoiceReplyControl,
}: IdeaAssistantPanelProps) {
  if (isCollapsed) return null;

  const isPlaybackActive = playbackStatus !== "idle";
  const voiceButtonLabel =
    playbackStatus === "playing"
      ? "Pause voice reply"
      : playbackStatus === "paused"
        ? "Resume voice reply"
        : "Play voice reply";

  return (
    <div className="idea-plan-card">
      <div className="idea-plan-card-head">
        <span className="idea-plan-card-badge">AI chat</span>
      </div>
      <div className="idea-chat-thread" ref={onThreadRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`idea-chat-message idea-chat-message--${message.role}`}
          >
            <p className="idea-plan-summary">{message.text}</p>
          </div>
        ))}
        {loading ? (
          <div className="idea-chat-message idea-chat-message--assistant">
            <p className="idea-plan-summary">{loadingStatus}</p>
          </div>
        ) : null}
        {gifUrl ? (
          <div className="idea-chat-message idea-chat-message--assistant">
            <img
              src={gifUrl}
              alt="AI generated action preview"
              className="idea-action-gif"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
      <div className="idea-chat-input-row">
        <textarea
          className="idea-chat-input"
          ref={onInputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              onSend();
            }
          }}
          placeholder={
            isMobileAssistantComposer ? "Ask AI" : "Ask AI a follow-up..."
          }
          rows={1}
          aria-label="Ask AI a follow-up"
        />
        <button
          type="button"
          className={`idea-chat-voice-btn${recording ? " is-recording" : ""}`}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleVoiceRecording();
          }}
          disabled={loading}
          aria-label={recording ? "Stop recording" : "Record voice message"}
          title={recording ? "Stop recording" : "Record voice message"}
        >
          {recording ? <IconStop size={14} /> : <IconMic size={14} />}
        </button>
        <button
          type="button"
          className={`idea-chat-voice-btn${isPlaybackActive || voiceRepliesEnabled ? " is-active" : ""}`}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVoiceReplyControl();
          }}
          aria-label={voiceButtonLabel}
          title={voiceButtonLabel}
        >
          {playbackStatus === "playing" ? (
            <IconStop size={12} />
          ) : (
            <IconPlay size={12} />
          )}
        </button>
        <button
          type="button"
          className="idea-chat-send-btn"
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSend();
          }}
          disabled={loading || !inputValue.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
