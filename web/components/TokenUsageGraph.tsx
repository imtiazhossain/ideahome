import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconScreenshot, IconUpload, IconVideo, IconX } from "./icons";
import { buildOptimizedPrompt } from "@ideahome/shared";
import type {
  PromptEfficiencyBreakdown,
  PromptUsageDetailEntry,
  PromptUsageTrendPoint,
} from "@ideahome/shared";
import {
  clearMyPromptUsage,
  fetchCodexPromptUsage,
  fetchMyPromptUsage,
  fetchProjectPromptUsageTrend,
  optimizeProjectPrompt,
} from "../lib/api";
import { CollapsibleSection } from "./CollapsibleSection";
import { IconRerun } from "./IconRerun";
import { IconCopy } from "./icons/IconCopy";
import {
  DEFAULT_CHART_HEIGHT,
  MAX_CHART_HEIGHT,
  MAX_VISIBLE_POINTS,
  MIN_CHART_HEIGHT,
  OPTIMIZER_METRIC_TIPS,
  SERIES,
  SHAREABLE_TEMPLATE,
  SOURCE_LABELS,
  SourcePill,
  type ChartPoint,
  type OptimizerAttachment,
  type SourceFilter,
  type ViewMode,
  MetricLabelWithTip,
  analyzeOptimizerPrompt,
  average,
  buildComparisonNotes,
  buildTrendPolyline,
  clamp,
  classifyOptimizerAttachment,
  copyOptimizerPayload,
  efficiencyTone,
  formatAxisDate,
  formatAxisTime,
  formatTimestamp,
  normalizeOptimizedPromptText,
  percentile,
  roundAxisStep,
  summaryLabel,
  summarizeProviderNote,
} from "./tokenUsageGraphUtils";

export function TokenUsageGraph({
  collapsed,
  onToggle,
  dragHandle,
  projectId,
}: {
  collapsed: boolean;
  onToggle: () => void;
  dragHandle: React.ReactNode;
  projectId: string | null;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [trendPoints, setTrendPoints] = useState<PromptUsageTrendPoint[]>([]);
  const [mineEntries, setMineEntries] = useState<PromptUsageDetailEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [insightCopied, setInsightCopied] = useState(false);
  const [optimizedCopied, setOptimizedCopied] = useState(false);
  const [optimizerCopied, setOptimizerCopied] = useState(false);
  const [optimizerCopyNote, setOptimizerCopyNote] = useState<string | null>(
    null
  );
  const [optimizerMediaError, setOptimizerMediaError] = useState<string | null>(
    null
  );
  const [optimizingDraft, setOptimizingDraft] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [codexImportedSessions, setCodexImportedSessions] = useState(0);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [optimizerAttachments, setOptimizerAttachments] = useState<
    OptimizerAttachment[]
  >([]);
  const [optimizerDragActive, setOptimizerDragActive] = useState(false);
  const [optimizedDraft, setOptimizedDraft] = useState<{
    sourcePrompt: string;
    originalPrompt: string;
    optimizedPrompt: string;
    editableTemplate: string;
    lastOptimizedTemplate: string;
    lastRunInputType: "original" | "edited-template";
    whyHigher: string[];
    notes: string[];
    providerNote: string | null;
    score: number;
    originalScore: number;
    breakdown: PromptEfficiencyBreakdown;
    gapHints: Array<{ title: string; example: string }>;
  } | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    left: number;
    top: number;
    point: ChartPoint;
  } | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<
    Array<(typeof SERIES)[number]["key"]>
  >(["totalTokens", "promptTokens", "completionTokens"]);
  const [showOutliers, setShowOutliers] = useState(true);
  const chartResizeRef = useRef<HTMLDivElement | null>(null);
  const chartViewportRef = useRef<HTMLDivElement | null>(null);
  const chartHeightStorageKey = useMemo(
    () =>
      `ideahome-code-token-usage-chart-height${projectId ? `-${projectId}` : ""}`,
    [projectId]
  );
  const [chartHeight, setChartHeight] = useState<number>(DEFAULT_CHART_HEIGHT);
  const [chartViewportWidth, setChartViewportWidth] = useState<number>(760);
  const optimizerFileInputRef = useRef<HTMLInputElement | null>(null);
  const optimizerAttachmentsRef = useRef<OptimizerAttachment[]>([]);

  useEffect(() => {
    optimizerAttachmentsRef.current = optimizerAttachments;
  }, [optimizerAttachments]);

  useEffect(() => {
    return () => {
      optimizerAttachmentsRef.current.forEach((attachment) => {
        URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(chartHeightStorageKey);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) {
        setChartHeight(
          clamp(Math.round(parsed), MIN_CHART_HEIGHT, MAX_CHART_HEIGHT)
        );
        return;
      }
    } catch {
      // ignore
    }
    setChartHeight(DEFAULT_CHART_HEIGHT);
  }, [chartHeightStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(chartHeightStorageKey, String(chartHeight));
    } catch {
      // ignore
    }
  }, [chartHeight, chartHeightStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = chartResizeRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = clamp(
        Math.round(entry.contentRect.height),
        MIN_CHART_HEIGHT,
        MAX_CHART_HEIGHT
      );
      setChartHeight((prev) => (prev === next ? prev : next));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = chartViewportRef.current;
    if (!node) return;
    const measure = () => {
      const nextWidth = Math.max(320, Math.round(node.clientWidth));
      setChartViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const mergeTrendPoints = useCallback(
    (
      appPoints: PromptUsageTrendPoint[],
      codexPoints: PromptUsageTrendPoint[]
    ): PromptUsageTrendPoint[] =>
      [...appPoints, ...codexPoints].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      ),
    []
  );

  const mergeDetailEntries = useCallback(
    (
      appEntries: PromptUsageDetailEntry[],
      codexEntries: PromptUsageDetailEntry[]
    ): PromptUsageDetailEntry[] =>
      [...appEntries, ...codexEntries].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp)
      ),
    []
  );

  const refresh = useCallback(async () => {
    if (!projectId) {
      startTransition(() => {
        setTrendPoints([]);
        setMineEntries([]);
        setError(null);
        setCodexImportedSessions(0);
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const includeAppSources = sourceFilter !== "codex-estimated";
      const includeCodex =
        sourceFilter === "all" || sourceFilter === "codex-estimated";
      const [trend, mine, codex] = await Promise.all([
        includeAppSources
          ? fetchProjectPromptUsageTrend(projectId, sourceFilter)
          : Promise.resolve({
              mode: "project" as const,
              source: "all" as const,
              points: [],
            }),
        includeAppSources
          ? fetchMyPromptUsage(projectId, sourceFilter)
          : Promise.resolve({ source: "all" as const, entries: [] }),
        includeCodex
          ? fetchCodexPromptUsage()
          : Promise.resolve({ entries: [], points: [], importedSessions: 0 }),
      ]);
      const mergedPoints = mergeTrendPoints(trend.points, codex.points);
      const mergedEntries = mergeDetailEntries(mine.entries, codex.entries);
      startTransition(() => {
        setTrendPoints(mergedPoints);
        setMineEntries(mergedEntries);
        setCodexImportedSessions(codex.importedSessions);
        setLastUpdatedAt(new Date().toISOString());
        setSelectedId((prev) =>
          prev && mergedEntries.some((entry) => entry.id === prev) ? prev : null
        );
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load prompt usage."
      );
    } finally {
      setLoading(false);
    }
  }, [mergeDetailEntries, mergeTrendPoints, projectId, sourceFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visiblePoints = useMemo(() => {
    if (viewMode === "project") {
      return trendPoints.map((point) => ({
        ...point,
        entry: null,
      }));
    }
    return mineEntries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      source: entry.source,
      totalTokens: entry.totalTokens,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      promptCount: 1,
      entry,
    }));
  }, [mineEntries, trendPoints, viewMode]);

  const selectedEntry = useMemo(
    () => mineEntries.find((entry) => entry.id === selectedId) ?? null,
    [mineEntries, selectedId]
  );

  const seriesValues = useMemo(() => {
    return visiblePoints.flatMap((point) => {
      const values: number[] = [];
      if (visibleSeries.includes("totalTokens")) values.push(point.totalTokens);
      if (visibleSeries.includes("promptTokens"))
        values.push(point.promptTokens);
      if (visibleSeries.includes("completionTokens"))
        values.push(point.completionTokens);
      return values;
    });
  }, [visiblePoints, visibleSeries]);

  const maxValue = useMemo(() => {
    const rawMax = Math.max(1, ...seriesValues);
    if (showOutliers || seriesValues.length < 8) return rawMax;
    const p95 = percentile(seriesValues, 0.95);
    return Math.max(1, Math.min(rawMax, Math.max(p95, rawMax * 0.2)));
  }, [seriesValues, showOutliers]);

  const selectedOptimizedPrompt = useMemo(() => {
    return selectedEntry ? buildOptimizedPrompt(selectedEntry.promptText) : "";
  }, [selectedEntry]);

  const findMatchingEntry = useCallback(
    (point: ChartPoint): PromptUsageDetailEntry | null => {
      return (
        mineEntries.find((entry) => {
          const sourceMatches =
            sourceFilter === "all" ? true : entry.source === sourceFilter;
          return (
            sourceMatches &&
            entry.timestamp === point.timestamp &&
            entry.totalTokens === point.totalTokens &&
            entry.promptTokens === point.promptTokens &&
            entry.completionTokens === point.completionTokens
          );
        }) ?? null
      );
    },
    [mineEntries, sourceFilter]
  );

  const overallSummary = useMemo(() => {
    if (mineEntries.length === 0) return null;
    const hintFrequency = new Map<string, number>();
    for (const entry of mineEntries) {
      for (const hint of entry.improvementHints) {
        hintFrequency.set(hint, (hintFrequency.get(hint) ?? 0) + 1);
      }
    }
    const commonHints = [...hintFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hint]) => hint);

    return {
      promptCount: mineEntries.length,
      efficiencyScore: average(
        mineEntries.map((entry) => entry.efficiencyScore)
      ),
      promptTokens: mineEntries.reduce(
        (sum, entry) => sum + entry.promptTokens,
        0
      ),
      completionTokens: mineEntries.reduce(
        (sum, entry) => sum + entry.completionTokens,
        0
      ),
      totalTokens: mineEntries.reduce(
        (sum, entry) => sum + entry.totalTokens,
        0
      ),
      promptWordCount: average(
        mineEntries.map((entry) => entry.promptWordCount)
      ),
      breakdown: {
        brevity: average(mineEntries.map((entry) => entry.breakdown.brevity)),
        outputEfficiency: average(
          mineEntries.map((entry) => entry.breakdown.outputEfficiency)
        ),
        redundancyPenalty: average(
          mineEntries.map((entry) => entry.breakdown.redundancyPenalty)
        ),
        instructionDensity: average(
          mineEntries.map((entry) => entry.breakdown.instructionDensity)
        ),
      },
      improvementHints:
        commonHints.length > 0
          ? commonHints
          : [
              "Write direct task-first prompts and keep only the context that changes the answer.",
            ],
    };
  }, [mineEntries]);

  const projectSummary = useMemo(() => {
    if (trendPoints.length === 0) return null;
    const totalPromptCount = trendPoints.reduce(
      (sum, point) => sum + point.promptCount,
      0
    );
    const totalPromptTokens = trendPoints.reduce(
      (sum, point) => sum + point.promptTokens,
      0
    );
    const totalCompletionTokens = trendPoints.reduce(
      (sum, point) => sum + point.completionTokens,
      0
    );
    const totalTokens = trendPoints.reduce(
      (sum, point) => sum + point.totalTokens,
      0
    );
    const promptTokenAverage =
      totalPromptCount > 0
        ? Math.round(totalPromptTokens / totalPromptCount)
        : 0;
    const completionTokenAverage =
      totalPromptCount > 0
        ? Math.round(totalCompletionTokens / totalPromptCount)
        : 0;
    const ratio =
      totalCompletionTokens > 0 ? totalPromptTokens / totalCompletionTokens : 0;

    return {
      promptCount: totalPromptCount,
      efficiencyScore: clamp(
        Math.round(
          100 -
            Math.max(0, promptTokenAverage - 40) * 0.35 -
            Math.max(0, ratio - 0.85) * 18
        ),
        0,
        100
      ),
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens,
      promptWordCount: 0,
      breakdown: {
        brevity: clamp(
          Math.round(35 - Math.max(0, promptTokenAverage - 40) * 0.16),
          0,
          35
        ),
        outputEfficiency: clamp(
          Math.round(30 - Math.max(0, ratio - 0.85) * 18),
          0,
          30
        ),
        redundancyPenalty: totalPromptCount > 0 ? 20 : 0,
        instructionDensity: totalPromptCount > 0 ? 15 : 0,
      },
      improvementHints: [
        "Open My prompts to inspect individual prompts and see exact rewrites.",
        "Trim repeated setup text in the prompts that produce the largest spikes.",
        "Add tighter output constraints so completions stay shorter and more predictable.",
      ],
    };
  }, [trendPoints]);

  const handleCopyTemplate = useCallback(async () => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(SHAREABLE_TEMPLATE);
    setTemplateCopied(true);
    window.setTimeout(() => setTemplateCopied(false), 1800);
  }, []);

  const handleCopyInsight = useCallback(async () => {
    if (!selectedEntry || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(
      [
        `Prompt usage review`,
        `Source: ${SOURCE_LABELS[selectedEntry.source]}`,
        selectedEntry.source === "codex-estimated"
          ? "Note: token counts are estimated from local Codex session text."
          : "",
        `Time: ${formatTimestamp(selectedEntry.timestamp)}`,
        `Score: ${selectedEntry.efficiencyScore}/100 (${efficiencyTone(selectedEntry.efficiencyScore)})`,
        `Prompt tokens: ${selectedEntry.promptTokens}`,
        `Completion tokens: ${selectedEntry.completionTokens}`,
        `Total tokens: ${selectedEntry.totalTokens}`,
        "",
        "Prompt:",
        selectedEntry.promptText,
        "",
        "Improve next time:",
        ...selectedEntry.improvementHints.map(
          (hint, index) => `${index + 1}. ${hint}`
        ),
        "",
        "Optimized prompt:",
        selectedOptimizedPrompt,
      ].join("\n")
    );
    setInsightCopied(true);
    window.setTimeout(() => setInsightCopied(false), 1800);
  }, [selectedEntry, selectedOptimizedPrompt]);

  const handleCopyOptimized = useCallback(async () => {
    if (!selectedOptimizedPrompt || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(selectedOptimizedPrompt);
    setOptimizedCopied(true);
    window.setTimeout(() => setOptimizedCopied(false), 1800);
  }, [selectedOptimizedPrompt]);

  const appendOptimizerAttachments = useCallback((files: File[]) => {
    const validFiles = files
      .map((file) => ({
        file,
        kind: classifyOptimizerAttachment(file),
      }))
      .filter(
        (entry): entry is { file: File; kind: "image" | "video" } =>
          entry.kind != null
      );

    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      setOptimizerMediaError(
        invalidCount === 1
          ? "Only screenshots and screen recordings can be attached here."
          : "Some files were skipped. Only screenshots and screen recordings can be attached here."
      );
    } else {
      setOptimizerMediaError(null);
    }
    if (validFiles.length === 0) return;

    setOptimizerAttachments((current) => [
      ...current,
      ...validFiles.map(({ file, kind }) => ({
        id:
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const handleOptimizerAttachmentInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";
      appendOptimizerAttachments(files);
    },
    [appendOptimizerAttachments]
  );

  const handleRemoveOptimizerAttachment = useCallback((id: string) => {
    setOptimizerAttachments((current) => {
      const match = current.find((attachment) => attachment.id === id);
      if (match) URL.revokeObjectURL(match.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const handleOptimizerDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setOptimizerDragActive(false);
      appendOptimizerAttachments(Array.from(event.dataTransfer.files ?? []));
    },
    [appendOptimizerAttachments]
  );

  const handleCopyOptimizerOutput = useCallback(async () => {
    try {
      const copyMode = await copyOptimizerPayload(
        templatePrompt,
        optimizerAttachments
      );
      setOptimizerCopyNote(
        copyMode === "media"
          ? "Copied the optimized prompt with attached screenshots and recordings."
          : optimizerAttachments.length > 0
            ? "Copied the optimized prompt text. This browser did not include the attached media."
            : null
      );
      setOptimizerMediaError(null);
      setOptimizerCopied(true);
      window.setTimeout(() => setOptimizerCopied(false), 1800);
    } catch (error) {
      setOptimizerCopyNote(null);
      setOptimizerMediaError(
        error instanceof Error
          ? error.message
          : "Failed to copy the optimized prompt."
      );
    }
  }, [optimizerAttachments, templatePrompt]);

  const runOptimizer = useCallback(
    async (prompt: string, runInputType: "original" | "edited-template") => {
      if (!projectId) return;
      if (!prompt) {
        setOptimizerError("Enter a prompt to optimize.");
        setOptimizedDraft(null);
        return;
      }
      setOptimizingDraft(true);
      setOptimizerError(null);
      try {
        const result = await optimizeProjectPrompt(projectId, prompt);
        const structuredPrompt = normalizeOptimizedPromptText(
          result.structuredPrompt?.trim() || result.optimizedPrompt.trim()
        );
        const sourcePrompt =
          runInputType === "original"
            ? prompt
            : optimizedDraft?.sourcePrompt?.trim() ||
              draftPrompt.trim() ||
              prompt;
        const originalAnalysis = analyzeOptimizerPrompt(sourcePrompt);
        const optimizedAnalysis = analyzeOptimizerPrompt(structuredPrompt);
        const scoreDelta = optimizedAnalysis.score - originalAnalysis.score;
        const providerNote = summarizeProviderNote(
          result.notes.find((note) => /^ai provider\b/i.test(note.trim())) ??
            null
        );
        setOptimizedDraft({
          sourcePrompt,
          originalPrompt: prompt,
          optimizedPrompt: structuredPrompt,
          editableTemplate: structuredPrompt,
          lastOptimizedTemplate: structuredPrompt,
          lastRunInputType: runInputType,
          whyHigher: buildComparisonNotes(
            sourcePrompt,
            structuredPrompt,
            result.notes,
            scoreDelta
          ),
          notes: result.notes,
          providerNote,
          score: optimizedAnalysis.score,
          originalScore: originalAnalysis.score,
          breakdown: optimizedAnalysis.breakdown,
          gapHints: optimizedAnalysis.gapHints,
        });
        setTemplatePrompt(structuredPrompt);
      } catch (error) {
        setOptimizedDraft(null);
        setOptimizerError(
          error instanceof Error ? error.message : "Failed to optimize prompt."
        );
      } finally {
        setOptimizingDraft(false);
      }
    },
    [draftPrompt, optimizedDraft?.sourcePrompt, projectId]
  );

  const handleOptimizeDraft = useCallback(async () => {
    await runOptimizer(draftPrompt.trim(), "original");
  }, [draftPrompt, runOptimizer]);

  const handleRerunTemplate = useCallback(async () => {
    await runOptimizer(templatePrompt.trim(), "edited-template");
  }, [runOptimizer, templatePrompt]);

  const handleClear = useCallback(async () => {
    if (!projectId) return;
    setClearing(true);
    try {
      await clearMyPromptUsage(projectId);
      await refresh();
    } finally {
      setClearing(false);
    }
  }, [projectId, refresh]);

  const liveOptimizerAnalysis = useMemo(() => {
    if (!optimizedDraft) return null;
    const currentPrompt =
      templatePrompt.trim() || optimizedDraft.optimizedPrompt;
    const currentAnalysis = analyzeOptimizerPrompt(currentPrompt);
    const originalAnalysis = analyzeOptimizerPrompt(
      optimizedDraft.sourcePrompt
    );
    const scoreDelta = currentAnalysis.score - originalAnalysis.score;
    return {
      currentPrompt,
      score: currentAnalysis.score,
      originalScore: originalAnalysis.score,
      scoreDelta,
      breakdown: currentAnalysis.breakdown,
      gapHints: currentAnalysis.gapHints,
      humanGapHints: currentAnalysis.humanGapHints,
      notes: buildComparisonNotes(
        optimizedDraft.sourcePrompt,
        currentPrompt,
        optimizedDraft.notes,
        scoreDelta
      ),
      providerNote: optimizedDraft.providerNote,
      notesHeading:
        scoreDelta > 0
          ? "Why This Scores Higher"
          : scoreDelta < 0
            ? "Why The Score Dropped"
            : "What Changed",
    };
  }, [optimizedDraft, templatePrompt]);

  const width =
    visiblePoints.length <= 1
      ? chartViewportWidth
      : visiblePoints.length <= MAX_VISIBLE_POINTS
        ? chartViewportWidth
        : Math.max(
            chartViewportWidth,
            80 +
              (visiblePoints.length - 1) *
                ((chartViewportWidth - 80) / (MAX_VISIBLE_POINTS - 1))
          );
  const height = chartHeight;
  const padding = 40;
  const stepX = (() => {
    if (visiblePoints.length <= 1) return 0;
    if (visiblePoints.length <= MAX_VISIBLE_POINTS) {
      return (width - padding * 2) / (visiblePoints.length - 1);
    }
    return (chartViewportWidth - padding * 2) / (MAX_VISIBLE_POINTS - 1);
  })();

  const chartPlotHeight = height - padding * 2;
  const toY = (value: number) =>
    height - padding - (Math.max(0, value) / maxValue) * chartPlotHeight;
  const yAxisTicks = useMemo(() => {
    const axisMax = roundAxisStep(maxValue);
    return Array.from({ length: 4 }, (_, index) => {
      const ratio = (3 - index) / 3;
      return {
        y: padding + (chartPlotHeight / 3) * index,
        value: Math.round(axisMax * ratio),
      };
    });
  }, [chartPlotHeight, maxValue, padding]);

  const handlePointHover = useCallback(
    (point: ChartPoint, x: number, y: number) => {
      setHoveredPoint({
        left: clamp((x / width) * 100, 8, 92),
        top: clamp((y / height) * 100, 12, 84),
        point,
      });
    },
    [height, width]
  );

  const handlePointSelect = useCallback(
    (point: ChartPoint) => {
      const matchedEntry = point.entry ?? findMatchingEntry(point);
      if (matchedEntry) {
        setSelectionMessage(null);
        setViewMode("mine");
        setSelectedId(matchedEntry.id);
        return;
      }
      if (viewMode === "project") {
        setSelectionMessage(
          "This project-trend point is aggregate-only. Switch to My prompts to inspect a prompt you authored."
        );
        return;
      }
      setSelectionMessage(
        "No prompt details are available for this point yet."
      );
    },
    [findMatchingEntry, viewMode]
  );

  const toggleSeries = useCallback(
    (seriesKey: (typeof SERIES)[number]["key"]) => {
      setVisibleSeries((current) => {
        if (current.includes(seriesKey)) {
          return current.length === 1
            ? current
            : current.filter((key) => key !== seriesKey);
        }
        return [...current, seriesKey];
      });
    },
    []
  );

  return (
    <CollapsibleSection
      sectionId="code-token-usage"
      title="Prompt Efficiency Tracker"
      collapsed={collapsed}
      onToggle={onToggle}
      sectionClassName="code-page-body-section prompt-usage-section"
      headingId="code-page-token-usage-heading"
      headerTrailing={dragHandle}
    >
      <div className="prompt-usage-hero">
        <div>
          <p className="prompt-usage-eyebrow">Token coaching</p>
          <p className="code-page-repos-copy prompt-usage-copy">
            Track prompt token usage over time, compare sources with a filter,
            and inspect your own prompts for concrete edits that reduce waste.
            Codex imports are estimated from local session text.
          </p>
        </div>
        <div className="prompt-usage-chip">{summaryLabel(visiblePoints)}</div>
      </div>

      {!projectId ? (
        <div className="prompt-usage-empty">
          Select a project to load prompt usage.
        </div>
      ) : (
        <>
          <div className="prompt-usage-toolbar">
            <div className="prompt-usage-pill-row" aria-label="Usage view mode">
              <SourcePill
                active={viewMode === "project"}
                onClick={() => setViewMode("project")}
              >
                Project trend
              </SourcePill>
              <SourcePill
                active={viewMode === "mine"}
                onClick={() => setViewMode("mine")}
              >
                My prompts
              </SourcePill>
            </div>
            <div className="prompt-usage-pill-row" aria-label="Source filter">
              {(
                [
                  "all",
                  "bulby-openrouter",
                  "gpt-openai",
                  "codex-estimated",
                ] as const
              ).map((source) => (
                <SourcePill
                  key={source}
                  active={sourceFilter === source}
                  onClick={() => setSourceFilter(source)}
                >
                  {SOURCE_LABELS[source]}
                </SourcePill>
              ))}
            </div>
            <div className="prompt-usage-toolbar-actions">
              <button
                type="button"
                className="code-page-rating-prompt-copy-btn"
                onClick={() => {
                  setSelectionMessage(null);
                  void refresh();
                }}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              {lastUpdatedAt ? (
                <span className="prompt-usage-last-updated">
                  Updated {formatTimestamp(lastUpdatedAt)}
                </span>
              ) : null}
              {codexImportedSessions > 0 ? (
                <span className="prompt-usage-last-updated">
                  Codex sessions scanned: {codexImportedSessions}
                </span>
              ) : null}
            </div>
          </div>

          <div className="prompt-usage-chart-card">
            {loading ? (
              <div className="prompt-usage-empty">Loading prompt usage…</div>
            ) : error ? (
              <div className="prompt-usage-empty">{error}</div>
            ) : visiblePoints.length === 0 ? (
              <div className="prompt-usage-empty">
                No prompt usage recorded for this filter yet.
              </div>
            ) : (
              <>
                <div className="prompt-usage-legend">
                  {SERIES.map((series) => (
                    <button
                      key={series.key}
                      type="button"
                      className={`prompt-usage-legend-item${
                        visibleSeries.includes(series.key)
                          ? " is-active"
                          : " is-muted"
                      }`}
                      onClick={() => toggleSeries(series.key)}
                      aria-pressed={visibleSeries.includes(series.key)}
                    >
                      <i style={{ backgroundColor: series.stroke }} />
                      {series.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="prompt-usage-outlier-btn"
                    onClick={() => setShowOutliers((current) => !current)}
                    aria-pressed={!showOutliers}
                  >
                    {showOutliers ? "Hide outliers" : "Show outliers"}
                  </button>
                </div>
                <div className="prompt-usage-chart-wrap">
                  <div className="prompt-usage-chart-frame">
                    <div
                      className="prompt-usage-y-axis-fixed"
                      style={{ height: `${chartHeight}px` }}
                      aria-hidden="true"
                    >
                      <div className="prompt-usage-y-axis-fixed-line" />
                      {yAxisTicks.map((tick) => (
                        <span
                          key={`fixed-${tick.y}-${tick.value}`}
                          className="prompt-usage-y-axis-fixed-label"
                          style={{ top: `${(tick.y / height) * 100}%` }}
                        >
                          {tick.value.toLocaleString()}
                        </span>
                      ))}
                    </div>
                    <div
                      ref={chartViewportRef}
                      className="prompt-usage-chart-scroll"
                    >
                      <div
                        className="prompt-usage-chart-track"
                        style={{ width: `${width}px` }}
                      >
                        <div
                          ref={chartResizeRef}
                          className="prompt-usage-chart-resizable"
                          style={{ height: `${chartHeight}px` }}
                        >
                          <svg
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                            className="prompt-usage-chart"
                            role="img"
                            aria-label={`${viewMode === "project" ? "Project" : "Personal"} prompt usage line graph`}
                          >
                            <defs>
                              <linearGradient
                                id="promptUsageBg"
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="rgba(91,140,255,0.16)"
                                />
                                <stop
                                  offset="100%"
                                  stopColor="rgba(255,122,89,0.1)"
                                />
                              </linearGradient>
                            </defs>
                            <rect
                              x="0"
                              y="0"
                              width={width}
                              height={height}
                              rx="20"
                              fill="url(#promptUsageBg)"
                            />
                            {Array.from({ length: 4 }, (_, index) => {
                              const y = padding + (chartPlotHeight / 3) * index;
                              return (
                                <line
                                  key={index}
                                  x1={padding}
                                  x2={width - padding}
                                  y1={y}
                                  y2={y}
                                  className="prompt-usage-gridline"
                                />
                              );
                            })}
                            {SERIES.map((series) =>
                              visibleSeries.includes(series.key) ? (
                                <polyline
                                  key={series.key}
                                  points={buildTrendPolyline(
                                    visiblePoints,
                                    series.key,
                                    width,
                                    height,
                                    padding,
                                    maxValue,
                                    series.xOffset
                                  )}
                                  fill="none"
                                  stroke={series.stroke}
                                  strokeWidth={series.strokeWidth}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity="0.48"
                                />
                              ) : null
                            )}
                            {visiblePoints.map((point, index) => {
                              const x = padding + index * stepX;
                              const isSelected =
                                viewMode === "mine" &&
                                point.entry != null &&
                                point.entry.id === selectedId;
                              const hoverY = Math.min(
                                toY(point.totalTokens),
                                toY(point.promptTokens),
                                toY(point.completionTokens)
                              );
                              return (
                                <g
                                  key={`${point.timestamp}-${index}`}
                                  onMouseEnter={() =>
                                    handlePointHover(point, x, hoverY)
                                  }
                                  onMouseMove={() =>
                                    handlePointHover(point, x, hoverY)
                                  }
                                  onMouseLeave={() => setHoveredPoint(null)}
                                >
                                  <circle
                                    cx={x + SERIES[0].xOffset}
                                    cy={toY(point.totalTokens)}
                                    r={isSelected ? 5 : SERIES[0].dotRadius}
                                    fill={SERIES[0].stroke}
                                    className="prompt-usage-dot"
                                    style={{
                                      opacity: visibleSeries.includes(
                                        "totalTokens"
                                      )
                                        ? 0.78
                                        : 0,
                                      pointerEvents: visibleSeries.includes(
                                        "totalTokens"
                                      )
                                        ? "auto"
                                        : "none",
                                    }}
                                    onClick={() => handlePointSelect(point)}
                                  />
                                  <circle
                                    cx={x + SERIES[1].xOffset}
                                    cy={toY(point.promptTokens)}
                                    r={SERIES[1].dotRadius}
                                    fill={SERIES[1].stroke}
                                    style={{
                                      opacity: visibleSeries.includes(
                                        "promptTokens"
                                      )
                                        ? 0.72
                                        : 0,
                                    }}
                                  />
                                  <circle
                                    cx={x + SERIES[2].xOffset}
                                    cy={toY(point.completionTokens)}
                                    r={SERIES[2].dotRadius}
                                    fill={SERIES[2].stroke}
                                    style={{
                                      opacity: visibleSeries.includes(
                                        "completionTokens"
                                      )
                                        ? 0.72
                                        : 0,
                                    }}
                                  />
                                  <circle
                                    cx={x}
                                    cy={hoverY}
                                    r="12"
                                    fill="transparent"
                                    className="prompt-usage-hit-area"
                                    onClick={() => handlePointSelect(point)}
                                  />
                                </g>
                              );
                            })}
                          </svg>
                          {hoveredPoint ? (
                            <div
                              className="prompt-usage-tooltip"
                              style={{
                                left: `${hoveredPoint.left}%`,
                                top: `${hoveredPoint.top}%`,
                              }}
                            >
                              <strong>
                                {formatTimestamp(hoveredPoint.point.timestamp)}
                              </strong>
                              <span>
                                Total{" "}
                                {hoveredPoint.point.totalTokens.toLocaleString()}
                              </span>
                              <span>
                                Prompt{" "}
                                {hoveredPoint.point.promptTokens.toLocaleString()}
                              </span>
                              <span>
                                Completion{" "}
                                {hoveredPoint.point.completionTokens.toLocaleString()}
                              </span>
                              {hoveredPoint.point.entry ? (
                                <span>
                                  Score{" "}
                                  {hoveredPoint.point.entry.efficiencyScore}/100
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div
                          className="prompt-usage-axis-labels"
                          aria-hidden="true"
                        >
                          {visiblePoints.map((point, index) => {
                            const x = padding + index * stepX;
                            return (
                              <span
                                key={`${point.timestamp}-${index}`}
                                className="prompt-usage-axis-label"
                                style={{ left: `${(x / width) * 100}%` }}
                              >
                                <span>{formatAxisDate(point.timestamp)}</span>
                                <small>{formatAxisTime(point.timestamp)}</small>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="prompt-usage-footnote">
                  {viewMode === "project"
                    ? "Project view shows aggregate token metrics only."
                    : "My prompts view lets you inspect the original prompt text and coaching details."}
                </p>
                {selectionMessage ? (
                  <p className="prompt-usage-footnote">{selectionMessage}</p>
                ) : null}
              </>
            )}
          </div>

          {(
            viewMode === "mine"
              ? selectedEntry || overallSummary
              : projectSummary
          ) ? (
            <div className="prompt-usage-detail-card">
              <div className="prompt-usage-detail-head">
                <div>
                  <p className="prompt-usage-detail-kicker">
                    {selectedEntry
                      ? SOURCE_LABELS[selectedEntry.source]
                      : viewMode === "project"
                        ? "Project trend"
                        : "Current filter"}
                  </p>
                  <h3>
                    {selectedEntry
                      ? "Prompt Analysis"
                      : "Overall Prompt Efficiency"}
                  </h3>
                  <p>
                    {selectedEntry
                      ? formatTimestamp(selectedEntry.timestamp)
                      : `${
                          viewMode === "project"
                            ? (projectSummary?.promptCount ?? 0)
                            : (overallSummary?.promptCount ?? 0)
                        } prompts in this view`}
                  </p>
                </div>
                {selectedEntry ? (
                  <button
                    type="button"
                    className="code-page-rating-prompt-copy-btn"
                    onClick={handleCopyInsight}
                  >
                    {insightCopied ? "Copied" : "Copy insights"}
                  </button>
                ) : null}
              </div>
              <div className="prompt-usage-score-row">
                <div className="prompt-usage-score-badge">
                  <strong>
                    {selectedEntry
                      ? selectedEntry.efficiencyScore
                      : viewMode === "project"
                        ? (projectSummary?.efficiencyScore ?? 0)
                        : (overallSummary?.efficiencyScore ?? 0)}
                  </strong>
                  <span>/100</span>
                </div>
                <div className="prompt-usage-metric-strip">
                  <span>
                    {selectedEntry
                      ? selectedEntry.promptTokens
                      : viewMode === "project"
                        ? (projectSummary?.promptTokens ?? 0)
                        : (overallSummary?.promptTokens ?? 0)}{" "}
                    prompt
                  </span>
                  <span>
                    {selectedEntry
                      ? selectedEntry.completionTokens
                      : viewMode === "project"
                        ? (projectSummary?.completionTokens ?? 0)
                        : (overallSummary?.completionTokens ?? 0)}{" "}
                    completion
                  </span>
                  <span>
                    {selectedEntry
                      ? selectedEntry.totalTokens
                      : viewMode === "project"
                        ? (projectSummary?.totalTokens ?? 0)
                        : (overallSummary?.totalTokens ?? 0)}{" "}
                    total
                  </span>
                  <span>
                    {selectedEntry
                      ? selectedEntry.promptWordCount
                      : viewMode === "project"
                        ? (projectSummary?.promptWordCount ?? 0)
                        : (overallSummary?.promptWordCount ?? 0)}{" "}
                    {selectedEntry
                      ? "words"
                      : viewMode === "project"
                        ? "avg words unavailable"
                        : "avg words"}
                  </span>
                </div>
              </div>
              <div className="prompt-usage-breakdown-grid">
                <div>
                  <MetricLabelWithTip
                    label="Brevity"
                    tip={OPTIMIZER_METRIC_TIPS.brevity}
                  />
                  <strong>
                    {selectedEntry
                      ? selectedEntry.breakdown.brevity
                      : viewMode === "project"
                        ? (projectSummary?.breakdown.brevity ?? 0)
                        : (overallSummary?.breakdown.brevity ?? 0)}
                  </strong>
                </div>
                <div>
                  <MetricLabelWithTip
                    label="Output efficiency"
                    tip={OPTIMIZER_METRIC_TIPS.outputEfficiency}
                  />
                  <strong>
                    {selectedEntry
                      ? selectedEntry.breakdown.outputEfficiency
                      : viewMode === "project"
                        ? (projectSummary?.breakdown.outputEfficiency ?? 0)
                        : (overallSummary?.breakdown.outputEfficiency ?? 0)}
                  </strong>
                </div>
                <div>
                  <MetricLabelWithTip
                    label="Redundancy control"
                    tip={OPTIMIZER_METRIC_TIPS.redundancyPenalty}
                  />
                  <strong>
                    {selectedEntry
                      ? selectedEntry.breakdown.redundancyPenalty
                      : viewMode === "project"
                        ? (projectSummary?.breakdown.redundancyPenalty ?? 0)
                        : (overallSummary?.breakdown.redundancyPenalty ?? 0)}
                  </strong>
                </div>
                <div>
                  <MetricLabelWithTip
                    label="Instruction density"
                    tip={OPTIMIZER_METRIC_TIPS.instructionDensity}
                  />
                  <strong>
                    {selectedEntry
                      ? selectedEntry.breakdown.instructionDensity
                      : viewMode === "project"
                        ? (projectSummary?.breakdown.instructionDensity ?? 0)
                        : (overallSummary?.breakdown.instructionDensity ?? 0)}
                  </strong>
                </div>
              </div>
              {selectedEntry ? (
                <>
                  <div className="prompt-usage-prompt-box">
                    {selectedEntry.promptText}
                  </div>
                  <div className="prompt-usage-optimized-card">
                    <div className="prompt-usage-template-head">
                      <div>
                        <p className="prompt-usage-detail-kicker">
                          Recommended rewrite
                        </p>
                        <h3>More Efficient Prompt</h3>
                        <p>
                          This version keeps the task explicit and removes
                          filler so the model spends fewer tokens parsing
                          intent.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="code-page-rating-prompt-copy-btn"
                        onClick={handleCopyOptimized}
                      >
                        {optimizedCopied ? "Copied" : "Copy rewrite"}
                      </button>
                    </div>
                    <div className="prompt-usage-prompt-box">
                      {selectedOptimizedPrompt}
                    </div>
                  </div>
                  {selectedEntry.source === "codex-estimated" ? (
                    <p className="prompt-usage-footnote">
                      Codex token counts are estimated from local session text,
                      not provider-reported usage.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="prompt-usage-footnote">
                  Click a point to inspect a specific prompt. Until then, this
                  card shows your overall efficiency for the current filter.
                </p>
              )}
              <div className="prompt-usage-hints">
                <h4>
                  {selectedEntry
                    ? "How to Reduce Tokens Next Time"
                    : "Top Improvement Priorities"}
                </h4>
                <ul>
                  {(
                    selectedEntry?.improvementHints ??
                    (viewMode === "project"
                      ? projectSummary?.improvementHints
                      : overallSummary?.improvementHints) ??
                    []
                  ).map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
              {selectedEntry ? (
                <div className="prompt-usage-actions">
                  <button
                    type="button"
                    className="code-page-rating-prompt-copy-btn"
                    onClick={() => setSelectedId(null)}
                  >
                    Back to overall
                  </button>
                  <button
                    type="button"
                    className="code-page-run-btn"
                    onClick={handleClear}
                    disabled={clearing}
                  >
                    {clearing ? "Clearing…" : "Clear app history"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="prompt-usage-template-card">
            <div className="prompt-usage-template-head">
              <div>
                <p className="prompt-usage-detail-kicker">Prompt optimizer</p>
                <h3>Rewrite a Prompt for Efficiency</h3>
                <p>
                  Paste a draft prompt, then run a model rewrite that fixes
                  spelling, grammar, syntax, and wording for a clearer and more
                  efficient prompt.
                </p>
              </div>
            </div>
            <div className="prompt-usage-optimizer-grid">
              <div>
                <label
                  className="prompt-usage-optimizer-label"
                  htmlFor="prompt-optimizer-input"
                >
                  Your prompt
                </label>
                <textarea
                  id="prompt-optimizer-input"
                  className="code-page-rating-prompt prompt-usage-template-box"
                  rows={8}
                  value={draftPrompt}
                  onChange={(event) => {
                    setDraftPrompt(event.target.value);
                    setOptimizedDraft(null);
                    setOptimizerError(null);
                    setOptimizerCopyNote(null);
                    setTemplatePrompt("");
                  }}
                  placeholder="Describe the task, context, and desired output. The optimizer will rewrite it only after you click Optimize."
                  spellCheck
                />
                <input
                  ref={optimizerFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="prompt-usage-optimizer-file-input"
                  onChange={handleOptimizerAttachmentInput}
                />
                <div
                  className={`prompt-usage-optimizer-media-dropzone${
                    optimizerDragActive ? " is-active" : ""
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (event.dataTransfer.types.includes("Files")) {
                      setOptimizerDragActive(true);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (event.dataTransfer)
                      event.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (
                      event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      return;
                    }
                    setOptimizerDragActive(false);
                  }}
                  onDrop={handleOptimizerDrop}
                >
                  <div className="prompt-usage-optimizer-media-copy">
                    <span className="prompt-usage-optimizer-media-title">
                      Add Screenshots or Screen Recordings
                    </span>
                    <p>
                      Upload or drop image and video files here. The optimizer
                      keeps them local, and the optimized prompt copy action
                      will include them when the browser clipboard supports
                      media paste.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="code-page-rating-prompt-copy-btn prompt-usage-optimizer-upload-btn"
                    onClick={() => optimizerFileInputRef.current?.click()}
                  >
                    <IconUpload size={16} />
                    <span>Upload media</span>
                  </button>
                </div>
                {optimizerAttachments.length > 0 ? (
                  <div className="prompt-usage-optimizer-attachments">
                    {optimizerAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="prompt-usage-optimizer-attachment-card"
                      >
                        <div className="prompt-usage-optimizer-attachment-preview">
                          {attachment.kind === "image" ? (
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.file.name}
                            />
                          ) : (
                            <video
                              src={attachment.previewUrl}
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                        </div>
                        <div className="prompt-usage-optimizer-attachment-meta">
                          <span className="prompt-usage-optimizer-attachment-name">
                            {attachment.file.name}
                          </span>
                          <span className="prompt-usage-optimizer-attachment-type">
                            {attachment.kind === "image" ? (
                              <>
                                <IconScreenshot size={12} />
                                Screenshot
                              </>
                            ) : (
                              <>
                                <IconVideo size={12} />
                                Screen recording
                              </>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="prompt-usage-optimizer-attachment-remove"
                          onClick={() =>
                            handleRemoveOptimizerAttachment(attachment.id)
                          }
                          aria-label={`Remove ${attachment.file.name}`}
                          title={`Remove ${attachment.file.name}`}
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!optimizedDraft ? (
                  <div className="prompt-usage-optimizer-actions">
                    <button
                      type="button"
                      className="code-page-run-btn prompt-usage-optimizer-cta"
                      onClick={handleOptimizeDraft}
                      disabled={
                        optimizingDraft || !draftPrompt.trim() || !projectId
                      }
                    >
                      {optimizingDraft ? "Optimizing…" : "Optimize"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="prompt-usage-optimizer-head">
                  <label
                    className="prompt-usage-optimizer-label"
                    htmlFor="prompt-optimizer-output"
                  >
                    Optimized prompt
                  </label>
                  {optimizedDraft && liveOptimizerAnalysis ? (
                    <span className="prompt-usage-last-updated">
                      Estimated score {liveOptimizerAnalysis.score}/100
                    </span>
                  ) : null}
                </div>
                <div className="prompt-usage-optimizer-output-shell">
                  <div className="prompt-usage-template-editor">
                    <textarea
                      id="prompt-optimizer-output"
                      name="optimizedPrompt"
                      className="code-page-rating-prompt prompt-usage-template-box"
                      rows={8}
                      value={optimizedDraft ? templatePrompt : ""}
                      onChange={(event) => {
                        if (!optimizedDraft) return;
                        const nextValue = event.target.value;
                        setTemplatePrompt(nextValue);
                        setOptimizedDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                editableTemplate: nextValue,
                              }
                            : prev
                        );
                      }}
                      placeholder="Your optimized prompt will appear here. Edit it, then rerun until the score reaches your target."
                      spellCheck
                      readOnly={!optimizedDraft}
                    />
                    {optimizedDraft ? (
                      <>
                        <button
                          type="button"
                          className="prompt-usage-template-rerun-icon"
                          onClick={handleRerunTemplate}
                          aria-label="Rerun optimizer with prompt"
                          title="Rerun optimizer with prompt"
                          disabled={optimizingDraft || !templatePrompt.trim()}
                        >
                          <IconRerun />
                        </button>
                        <button
                          type="button"
                          className="prompt-usage-optimizer-copy-icon"
                          onClick={handleCopyOptimizerOutput}
                          aria-label="Copy optimized prompt and media"
                          title={
                            optimizerCopied
                              ? "Copied"
                              : "Copy optimized prompt and media"
                          }
                        >
                          <IconCopy size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                  {optimizedDraft ? (
                    <>
                      <div className="prompt-usage-optimizer-score-strip">
                        <span>
                          Original{" "}
                          {liveOptimizerAnalysis?.originalScore ??
                            optimizedDraft.originalScore}
                          /100
                        </span>
                        <span>
                          Optimized{" "}
                          {liveOptimizerAnalysis?.score ?? optimizedDraft.score}
                          /100
                        </span>
                        <span>
                          Improvement{" "}
                          {(liveOptimizerAnalysis?.scoreDelta ??
                            optimizedDraft.score -
                              optimizedDraft.originalScore) >= 0
                            ? "+"
                            : ""}
                          {liveOptimizerAnalysis?.scoreDelta ??
                            optimizedDraft.score - optimizedDraft.originalScore}
                        </span>
                      </div>
                      <div className="prompt-usage-breakdown-grid prompt-usage-optimizer-breakdown">
                        <div>
                          <MetricLabelWithTip
                            label="Brevity"
                            tip={OPTIMIZER_METRIC_TIPS.brevity}
                          />
                          <strong>
                            {liveOptimizerAnalysis?.breakdown.brevity ??
                              optimizedDraft.breakdown.brevity}
                            /35
                          </strong>
                        </div>
                        <div>
                          <MetricLabelWithTip
                            label="Output efficiency"
                            tip={OPTIMIZER_METRIC_TIPS.outputEfficiency}
                          />
                          <strong>
                            {liveOptimizerAnalysis?.breakdown
                              .outputEfficiency ??
                              optimizedDraft.breakdown.outputEfficiency}
                            /30
                          </strong>
                        </div>
                        <div>
                          <MetricLabelWithTip
                            label="Redundancy control"
                            tip={OPTIMIZER_METRIC_TIPS.redundancyPenalty}
                          />
                          <strong>
                            {liveOptimizerAnalysis?.breakdown
                              .redundancyPenalty ??
                              optimizedDraft.breakdown.redundancyPenalty}
                            /20
                          </strong>
                        </div>
                        <div>
                          <MetricLabelWithTip
                            label="Instruction density"
                            tip={OPTIMIZER_METRIC_TIPS.instructionDensity}
                          />
                          <strong>
                            {liveOptimizerAnalysis?.breakdown
                              .instructionDensity ??
                              optimizedDraft.breakdown.instructionDensity}
                            /15
                          </strong>
                        </div>
                      </div>
                      <div className="prompt-usage-optimizer-head">
                        <span className="prompt-usage-last-updated">
                          Last run input:{" "}
                          {optimizedDraft.lastRunInputType === "original"
                            ? "original prompt"
                            : "edited optimized prompt"}
                        </span>
                      </div>
                      {(liveOptimizerAnalysis?.notes.length ??
                        optimizedDraft.whyHigher.length) > 0 ? (
                        <div className="prompt-usage-hints prompt-usage-optimizer-notes">
                          <h4>
                            {liveOptimizerAnalysis?.notesHeading ??
                              "Why This Scores Higher"}
                          </h4>
                          <ul>
                            {(
                              liveOptimizerAnalysis?.notes ??
                              optimizedDraft.whyHigher
                            ).map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {liveOptimizerAnalysis?.providerNote ? (
                        <p className="prompt-usage-footnote">
                          {liveOptimizerAnalysis.providerNote}
                        </p>
                      ) : null}
                      {(liveOptimizerAnalysis?.humanGapHints.length ?? 0) >
                      0 ? (
                        <div className="prompt-usage-hints prompt-usage-optimizer-notes">
                          <h4>To Reach 100/100</h4>
                          <ul>
                            {liveOptimizerAnalysis?.humanGapHints.map(
                              (hint) => (
                                <li key={hint.title}>
                                  <strong>{hint.title}</strong>
                                  <span className="prompt-usage-hint-example">
                                    {hint.example}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {optimizerError ? (
                  <p className="prompt-usage-footnote">{optimizerError}</p>
                ) : optimizerMediaError ? (
                  <p className="prompt-usage-footnote">{optimizerMediaError}</p>
                ) : optimizerCopyNote ? (
                  <p className="prompt-usage-footnote">{optimizerCopyNote}</p>
                ) : optimizedDraft ? (
                  <p className="prompt-usage-footnote">
                    The score updates as you edit. Additional guidance appears
                    only when the optimizer still needs human input.
                  </p>
                ) : (
                  <p className="prompt-usage-footnote">
                    The optimizer stays blank until you click Optimize.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="prompt-usage-template-card">
            <div className="prompt-usage-template-head">
              <div>
                <p className="prompt-usage-detail-kicker">Shareable template</p>
                <h3>Prompt Coach Prompt</h3>
              </div>
              <div className="prompt-usage-template-actions">
                <button
                  type="button"
                  className="code-page-rating-prompt-copy-btn"
                  onClick={() => setTemplateOpen((prev) => !prev)}
                  aria-expanded={templateOpen}
                >
                  {templateOpen ? "Collapse" : "Expand"}
                </button>
                <button
                  type="button"
                  className="code-page-rating-prompt-copy-btn"
                  onClick={handleCopyTemplate}
                >
                  {templateCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            {templateOpen ? (
              <textarea
                aria-label="Prompt coach template"
                className="code-page-rating-prompt prompt-usage-template-box"
                readOnly
                rows={8}
                value={SHAREABLE_TEMPLATE}
              />
            ) : (
              <p className="prompt-usage-footnote">
                Expand to view the reusable prompt template.
              </p>
            )}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
