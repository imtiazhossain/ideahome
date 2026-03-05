import React from "react";
import type { ProjectQualityScoreConfig, QualityScoreItemId } from "../../lib/api";
import { CloseButton } from "../../components/CloseButton";
import { UiInput } from "../../components/UiInput";
import { Text } from "../../components/Text";
import { IconUndo } from "../../components/IconUndo";

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
  const [undoHistory, setUndoHistory] = React.useState<ProjectQualityScoreConfig[]>(
    []
  );
  const [initialConfig, setInitialConfig] =
    React.useState<ProjectQualityScoreConfig | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setUndoHistory([]);
    setInitialConfig({
      ...config,
      weights: { ...config.weights },
    });
  }, [open]);

  if (!open) return null;

  const hasInvalidTotal = total !== 100;
  const getWeight = (value: unknown): number => {
    const parsed = Number.parseInt(String(value ?? 0), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
  };
  const hasNetNumberChanges =
    initialConfig !== null &&
    items.some(
      (item) =>
        getWeight(config.weights[item.id]) !==
        getWeight(initialConfig.weights[item.id])
    );
  const canUndo = undoHistory.length > 0 && hasNetNumberChanges;
  const parseWeight = (value: string): number => {
    const digitsOnly = value.replace(/\D+/g, "");
    if (!digitsOnly) return 0;
    const parsed = Number.parseInt(digitsOnly, 10);
    return Math.max(0, Math.min(100, parsed));
  };
  const pushUndoSnapshot = () => {
    setUndoHistory((prev) => [
      ...prev.slice(-49),
      {
        ...config,
        weights: { ...config.weights },
      },
    ]);
  };
  const resetToEqualWeights = () => {
    if (items.length === 0) return;
    const baseWeight = Math.floor(100 / items.length);
    const remainder = 100 - baseWeight * items.length;
    const nextWeights = { ...config.weights };
    items.forEach((item, index) => {
      nextWeights[item.id] = baseWeight + (index < remainder ? 1 : 0);
    });
    const hasActualChange = items.some(
      (item) => getWeight(config.weights[item.id]) !== getWeight(nextWeights[item.id])
    );
    if (!hasActualChange) return;
    pushUndoSnapshot();
    setConfig((prev) => ({
      ...prev,
      weights: nextWeights,
    }));
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
          <CloseButton className="modal-close" onClick={onClose} />
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
                  maxLength={3}
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
                    const currentValue = Math.max(
                      0,
                      Math.min(
                        100,
                        Number.parseInt(String(config.weights[item.id] ?? 0), 10) || 0
                      )
                    );
                    if (clamped === currentValue) return;
                    pushUndoSnapshot();
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
          {canUndo ? (
            <button
              type="button"
              className="tests-page-section-undo"
              onClick={() => {
                const previousConfig = undoHistory[undoHistory.length - 1];
                if (!previousConfig) return;
                setUndoHistory((prev) => prev.slice(0, -1));
                setConfig({
                  ...previousConfig,
                  weights: { ...previousConfig.weights },
                });
              }}
              aria-label="Undo last change"
              title="Undo"
              disabled={saving}
            >
              <IconUndo />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetToEqualWeights}
            disabled={saving || items.length === 0}
          >
            Defaults
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          {(hasNetNumberChanges || saving) && !hasInvalidTotal ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
