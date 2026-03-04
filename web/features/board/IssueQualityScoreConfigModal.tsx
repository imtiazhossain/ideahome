import React from "react";
import type { ProjectQualityScoreConfig, QualityScoreItemId } from "../../lib/api";
import { UiInput } from "../../components/UiInput";
import { Text } from "../../components/Text";

type ScoreItemDefinition = {
  id: QualityScoreItemId;
  label: string;
};

export type IssueQualityScoreConfigModalProps = {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  config: ProjectQualityScoreConfig;
  setConfig: React.Dispatch<React.SetStateAction<ProjectQualityScoreConfig>>;
  total: number;
  items: ScoreItemDefinition[];
  onSave: () => Promise<void>;
};

export function IssueQualityScoreConfigModal({
  open,
  onClose,
  saving,
  error,
  config,
  setConfig,
  total,
  items,
  onSave,
}: IssueQualityScoreConfigModalProps) {
  if (!open) return null;

  const hasInvalidTotal = total !== 100;
  const parseWeight = (value: string): number => {
    const digitsOnly = value.replace(/\D+/g, "");
    if (!digitsOnly) return 0;
    const parsed = Number.parseInt(digitsOnly, 10);
    return Math.max(0, Math.min(100, parsed));
  };

  return (
    <div
      className="modal-overlay modal-overlay--above-detail"
      onClick={onClose}
    >
      <div
        className="modal issue-quality-config-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <Text as="h2" variant="title">Quality Score Configuration</Text>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="issue-quality-config-body">
          {error && (
            <Text as="div" variant="caption" tone="danger" className="issue-quality-config-error">
              {error}
            </Text>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="issue-quality-config-row"
            >
              <Text as="label" variant="label" htmlFor={`quality-config-${item.id}`}>{item.label}</Text>
              <div className="issue-quality-config-input-wrap">
                <UiInput
                  id={`quality-config-${item.id}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="issue-quality-config-input ui-input--compact"
                  value={Math.max(
                    0,
                    Math.min(
                      100,
                      Number.parseInt(String(config.weights[item.id] ?? 0), 10) || 0
                    )
                  )}
                  onChange={(e) => {
                    const clamped = parseWeight(e.target.value);
                    setConfig((prev) => ({
                      ...prev,
                      weights: {
                        ...prev.weights,
                        [item.id]: clamped,
                      },
                    }));
                  }}
                  onBlur={(e) => {
                    const normalized = parseWeight(e.currentTarget.value);
                    e.currentTarget.value = String(normalized);
                  }}
                />
                <Text as="span" variant="caption" tone="muted">%</Text>
              </div>
            </div>
          ))}

          <Text
            as="div"
            variant="caption"
            className={`issue-quality-config-total${hasInvalidTotal ? " is-invalid" : ""}`}
          >
            Total: {total}%
          </Text>
          {hasInvalidTotal && (
            <Text as="div" variant="caption" tone="danger" className="issue-quality-config-total-error">
              Total must equal 100% before saving.
            </Text>
          )}
        </div>

        <div className="modal-actions issue-quality-config-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSave()}
            disabled={saving || hasInvalidTotal}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
