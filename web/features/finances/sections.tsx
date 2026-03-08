import React, {
  type Dispatch,
  type ReactNode,
  type Ref,
  type SetStateAction,
} from "react";
import type { Expense, PlaidLinkedAccount } from "../../lib/api";
import { isAuthenticated } from "../../lib/api";
import { formatCurrency, formatRelativeTime } from "../../lib/utils";
import { ExpenseCategoryDropdown } from "../../components/ExpenseCategoryDropdown";
import {
  ExpensesDateFilterDropdown,
  dayOfMonthOrdinal,
  type DateFilterMode,
} from "../../components/ExpensesDateFilterDropdown";
import { IconPlus } from "../../components/IconPlus";
import { IconTrash } from "../../components/IconTrash";
import { CalendarPickerPopup } from "../../components/CalendarPickerPopup";
import { ProjectSectionGuard } from "../../components/ProjectSectionGuard";
import { CollapsibleSection } from "../../components/CollapsibleSection";
import { EXPENSE_CATEGORIES } from "@ideahome/shared";
import {
  MONTH_NAMES,
  TAX_CHECKLIST_ITEMS,
  formatBytes,
  formatExpenseDateDisplay,
  taxDocInsight,
  taxKindLabel,
  type ExpenseSortField,
  type TaxChecklistState,
  type TaxDocument,
} from "./utils";

type FinancesSectionContentProps = {
  sectionId: string;
  dragHandle: ReactNode;
  projectsLoaded: boolean;
  selectedProjectId: string | null;
  dateFilterMode: DateFilterMode;
  filterDay: string;
  filterDayOfMonth: number;
  filterMonth: number;
  filterYear: number;
  rangeStart: string;
  rangeEnd: string;
  expenses: Expense[];
  expensesForSummary: Expense[];
  filteredExpenses: Expense[];
  categoryFilter: string | null;
  expenseSearchQuery: string;
  sortBy: ExpenseSortField;
  sortDir: "asc" | "desc";
  total: number;
  byCategory: Record<string, number>;
  canAddExpense: boolean;
  taxDocuments: TaxDocument[];
  taxChecklist: TaxChecklistState;
  taxChecklistCompleted: number;
  taxReadinessScore: number;
  taxReadinessLabel: string;
  missingTaxCoverageLabels: string[];
  taxUploadError: string;
  taxUploading: boolean;
  plaidError: string;
  plaidConnectButtonLoading: boolean;
  linkedAccounts: PlaidLinkedAccount[];
  linkedAccountsCollapsed: boolean;
  lastSyncedAt: string | null;
  syncLoading: boolean;
  importedCount: number;
  deleteImportedConfirming: boolean;
  deleteImportedLoading: boolean;
  editingLinkedAccountId: string | null;
  editingLinkedAccountName: string;
  renamingLinkedAccountId: string | null;
  date: string;
  description: string;
  amount: string;
  category: string;
  categoryDropdownOpen: boolean;
  datePickerOpen: boolean;
  editingCategoryId: string | null;
  editingDescriptionId: string | null;
  editingDescriptionValue: string;
  dateFilterOpen: boolean;
  categoryDropdownRef: Ref<HTMLDivElement>;
  listCategoryDropdownRef: Ref<HTMLDivElement>;
  datePickerRef: Ref<HTMLDivElement>;
  descriptionInputRef: Ref<HTMLInputElement>;
  taxUploadInputRef: Ref<HTMLInputElement>;
  isSectionCollapsed: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
  setCategoryFilter: Dispatch<SetStateAction<string | null>>;
  setLinkedAccountsCollapsed: Dispatch<SetStateAction<boolean>>;
  setEditingLinkedAccountName: Dispatch<SetStateAction<string>>;
  setTaxDocuments: Dispatch<SetStateAction<TaxDocument[]>>;
  setAddExpenseError: Dispatch<SetStateAction<string>>;
  setDate: Dispatch<SetStateAction<string>>;
  setDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  setDescription: Dispatch<SetStateAction<string>>;
  setAmount: Dispatch<SetStateAction<string>>;
  setCategory: Dispatch<SetStateAction<string>>;
  setCategoryDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setExpenseSearchQuery: Dispatch<SetStateAction<string>>;
  setDateFilterMode: Dispatch<SetStateAction<DateFilterMode>>;
  setFilterDay: Dispatch<SetStateAction<string>>;
  setFilterDayOfMonth: Dispatch<SetStateAction<number>>;
  setFilterMonth: Dispatch<SetStateAction<number>>;
  setFilterYear: Dispatch<SetStateAction<number>>;
  setRangeStart: Dispatch<SetStateAction<string>>;
  setRangeEnd: Dispatch<SetStateAction<string>>;
  setDateFilterOpen: Dispatch<SetStateAction<boolean>>;
  setEditingCategoryId: Dispatch<SetStateAction<string | null>>;
  setEditingDescriptionValue: Dispatch<SetStateAction<string>>;
  openTaxFilePicker: () => void;
  handleConnectPlaid: () => void;
  prefetchPlaidLinkToken: () => void;
  handleSyncPlaid: () => void;
  startEditingLinkedAccount: (account: PlaidLinkedAccount) => void;
  saveLinkedAccountName: (
    accountId: string,
    name: string
  ) => void | Promise<void>;
  cancelEditingLinkedAccount: () => void;
  handleDisconnectPlaid: (plaidItemId: string) => void | Promise<void>;
  handleDeleteAllImportedConfirm: () => void;
  handleDeleteAllImportedCancel: () => void;
  handleDeleteAllImportedSubmit: () => void | Promise<void>;
  handleTaxUpload: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void | Promise<void>;
  handleTaxChecklistToggle: (id: keyof TaxChecklistState) => void;
  handleTaxDownload: (doc: TaxDocument) => void | Promise<void>;
  removeTaxDocument: (id: string) => void | Promise<void>;
  updateTaxDocumentNotes: (id: string, notes: string) => void | Promise<void>;
  addExpense: (event: React.FormEvent) => void | Promise<void>;
  handleSort: (field: ExpenseSortField) => void;
  startEditingDescription: (item: Expense) => void;
  saveExpenseDescription: (
    id: string,
    description: string
  ) => void | Promise<void>;
  cancelEditingDescription: () => void;
  updateExpenseCategory: (id: string, category: string) => void | Promise<void>;
  removeExpense: (id: string) => void | Promise<void>;
};

export function FinancesSectionContent({
  sectionId,
  dragHandle,
  projectsLoaded,
  selectedProjectId,
  dateFilterMode,
  filterDay,
  filterDayOfMonth,
  filterMonth,
  filterYear,
  rangeStart,
  rangeEnd,
  expenses,
  expensesForSummary,
  filteredExpenses,
  categoryFilter,
  expenseSearchQuery,
  sortBy,
  sortDir,
  total,
  byCategory,
  canAddExpense,
  taxDocuments,
  taxChecklist,
  taxChecklistCompleted,
  taxReadinessScore,
  taxReadinessLabel,
  missingTaxCoverageLabels,
  taxUploadError,
  taxUploading,
  plaidError,
  plaidConnectButtonLoading,
  linkedAccounts,
  linkedAccountsCollapsed,
  lastSyncedAt,
  syncLoading,
  importedCount,
  deleteImportedConfirming,
  deleteImportedLoading,
  editingLinkedAccountId,
  editingLinkedAccountName,
  renamingLinkedAccountId,
  date,
  description,
  amount,
  category,
  categoryDropdownOpen,
  datePickerOpen,
  editingCategoryId,
  editingDescriptionId,
  editingDescriptionValue,
  dateFilterOpen,
  categoryDropdownRef,
  listCategoryDropdownRef,
  datePickerRef,
  descriptionInputRef,
  taxUploadInputRef,
  isSectionCollapsed,
  toggleSection,
  setCategoryFilter,
  setLinkedAccountsCollapsed,
  setEditingLinkedAccountName,
  setTaxDocuments,
  setAddExpenseError,
  setDate,
  setDatePickerOpen,
  setDescription,
  setAmount,
  setCategory,
  setCategoryDropdownOpen,
  setExpenseSearchQuery,
  setDateFilterMode,
  setFilterDay,
  setFilterDayOfMonth,
  setFilterMonth,
  setFilterYear,
  setRangeStart,
  setRangeEnd,
  setDateFilterOpen,
  setEditingCategoryId,
  setEditingDescriptionValue,
  openTaxFilePicker,
  handleConnectPlaid,
  prefetchPlaidLinkToken,
  handleSyncPlaid,
  startEditingLinkedAccount,
  saveLinkedAccountName,
  cancelEditingLinkedAccount,
  handleDisconnectPlaid,
  handleDeleteAllImportedConfirm,
  handleDeleteAllImportedCancel,
  handleDeleteAllImportedSubmit,
  handleTaxUpload,
  handleTaxChecklistToggle,
  handleTaxDownload,
  removeTaxDocument,
  updateTaxDocumentNotes,
  addExpense,
  handleSort,
  startEditingDescription,
  saveExpenseDescription,
  cancelEditingDescription,
  updateExpenseCategory,
  removeExpense,
}: FinancesSectionContentProps) {
  if (sectionId === "expenses-summary") {
    return (
      <CollapsibleSection
        sectionId="expenses-summary"
        title={
          <>
            Summary{" "}
            {dateFilterMode !== "all" && (
              <span className="expenses-summary-period" aria-hidden="true">
                {dateFilterMode === "day" &&
                  formatExpenseDateDisplay(filterDay)}
                {dateFilterMode === "dayOfMonth" &&
                  `${dayOfMonthOrdinal(filterDayOfMonth)} of every month`}
                {dateFilterMode === "month" &&
                  `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
                {dateFilterMode === "year" && String(filterYear)}
                {dateFilterMode === "range" && `${rangeStart} – ${rangeEnd}`}
              </span>
            )}{" "}
            <span
              className="tests-page-section-count"
              aria-label="Number of expenses"
            >
              {expensesForSummary.length} Expenses
            </span>
          </>
        }
        collapsed={isSectionCollapsed("expenses-summary")}
        onToggle={() => toggleSection("expenses-summary")}
        sectionClassName="expenses-summary-section"
        headerTrailing={dragHandle}
      >
        <div className="expenses-summary-total" aria-label="Total amount">
          {formatCurrency(total)}
        </div>
        {Object.keys(byCategory).length > 0 && (
          <ul className="expenses-summary-list" aria-label="By category">
            {Object.entries(byCategory)
              .sort(([catA, sumA], [catB, sumB]) =>
                sumB !== sumA ? sumB - sumA : catA.localeCompare(catB)
              )
              .map(([cat, sum]) => (
                <li key={cat} className="expenses-summary-list-item">
                  <button
                    type="button"
                    className={
                      "expenses-summary-list-item-btn" +
                      (categoryFilter === cat ? " is-selected" : "")
                    }
                    onClick={() =>
                      setCategoryFilter((prev) => (prev === cat ? null : cat))
                    }
                    aria-pressed={categoryFilter === cat}
                    aria-label={
                      categoryFilter === cat
                        ? `Show all categories (currently filtering by ${cat})`
                        : `Show only ${cat} expenses`
                    }
                  >
                    <span className="expenses-summary-category">{cat}</span>
                    <span className="expenses-summary-amount">
                      {formatCurrency(sum)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </CollapsibleSection>
    );
  }

  if (sectionId === "expenses-financials") {
    if (!isAuthenticated()) {
      return (
        <CollapsibleSection
          sectionId="expenses-auth-notice"
          title="Sync Notice"
          collapsed={isSectionCollapsed("expenses-auth-notice")}
          onToggle={() => toggleSection("expenses-auth-notice")}
          sectionClassName="expenses-auth-notice"
          headerTrailing={dragHandle}
        >
          <p className="expenses-auth-notice-text" role="status">
            Expenses are stored on this device only. Sign in to save them to
            your account and sync across devices.
          </p>
        </CollapsibleSection>
      );
    }

    return (
      <CollapsibleSection
        sectionId="expenses-plaid"
        title="Link Financials"
        collapsed={isSectionCollapsed("expenses-plaid")}
        onToggle={() => toggleSection("expenses-plaid")}
        sectionClassName="expenses-plaid-section"
        headingId="expenses-plaid-heading"
        headerTrailing={dragHandle}
      >
        <p className="expenses-plaid-desc">
          Connect a bank or credit card to import transactions as expenses.
        </p>
        {plaidError && (
          <p className="expenses-error-notice-text" role="alert">
            {plaidError}
          </p>
        )}
        <div className="expenses-plaid-actions">
          <button
            type="button"
            className="project-nav-add expenses-plaid-connect-btn"
            onClick={handleConnectPlaid}
            onMouseEnter={prefetchPlaidLinkToken}
            onFocus={prefetchPlaidLinkToken}
            disabled={plaidConnectButtonLoading}
            aria-label="Connect bank or card"
            aria-busy={plaidConnectButtonLoading}
          >
            {plaidConnectButtonLoading && (
              <span
                className="upload-spinner upload-spinner--btn"
                aria-hidden="true"
              />
            )}
            <span className="expenses-plaid-connect-btn-text">
              {plaidConnectButtonLoading
                ? "Connecting…"
                : "Connect bank or card"}
            </span>
          </button>
          {linkedAccounts.length > 0 && selectedProjectId && (
            <div className="expenses-plaid-action">
              <button
                type="button"
                className="project-nav-add expenses-plaid-sync-btn"
                onClick={handleSyncPlaid}
                disabled={syncLoading}
                aria-label="Sync transactions into expenses"
                aria-busy={syncLoading}
              >
                {syncLoading ? "Syncing…" : "Sync transactions"}
              </button>
              {lastSyncedAt != null && (
                <span className="expenses-plaid-last-synced" role="status">
                  Last synced {formatRelativeTime(lastSyncedAt)}
                </span>
              )}
            </div>
          )}
        </div>
        {linkedAccounts.length > 0 && (
          <div className="expenses-plaid-linked-wrap">
            <button
              type="button"
              className={
                "expenses-plaid-linked-toggle" +
                (linkedAccountsCollapsed ? " is-collapsed" : "")
              }
              onClick={() => setLinkedAccountsCollapsed((prev) => !prev)}
              aria-expanded={!linkedAccountsCollapsed}
              aria-controls="expenses-plaid-linked-list"
            >
              <span
                className="expenses-plaid-linked-toggle-chevron"
                aria-hidden="true"
              >
                ▶
              </span>
              <span className="expenses-plaid-linked-toggle-label">
                Linked accounts
              </span>
              <span className="tests-page-section-count">
                {linkedAccounts.length}
              </span>
            </button>
            {!linkedAccountsCollapsed && (
              <ul
                id="expenses-plaid-linked-list"
                className="expenses-plaid-linked-list"
                aria-label="Linked accounts"
              >
                {linkedAccounts.map((account) => (
                  <li key={account.id} className="expenses-plaid-linked-item">
                    {editingLinkedAccountId === account.id ? (
                      <input
                        type="text"
                        value={editingLinkedAccountName}
                        onChange={(event) =>
                          setEditingLinkedAccountName(event.target.value)
                        }
                        onBlur={() =>
                          void saveLinkedAccountName(
                            account.id,
                            editingLinkedAccountName
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelEditingLinkedAccount();
                          }
                        }}
                        autoFocus
                        aria-label="Edit linked account name"
                        className="expenses-item-description-input"
                      />
                    ) : (
                      <span
                        className="expenses-plaid-linked-name expenses-item-description-editable"
                        role="button"
                        tabIndex={0}
                        onClick={() => startEditingLinkedAccount(account)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            startEditingLinkedAccount(account);
                          }
                        }}
                        title="Click to Rename Account"
                        aria-label={`Rename ${account.institutionName ?? "account"}`}
                      >
                        {account.institutionName ?? "Bank or card"}
                      </span>
                    )}
                    <button
                      type="button"
                      className="expenses-plaid-disconnect-btn"
                      onClick={() => void handleDisconnectPlaid(account.id)}
                      disabled={renamingLinkedAccountId === account.id}
                      aria-label={`Disconnect ${account.institutionName ?? "account"}`}
                    >
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {importedCount > 0 && selectedProjectId && (
          <div className="expenses-plaid-delete-imported-wrap">
            {deleteImportedConfirming ? (
              <>
                <span className="expenses-plaid-delete-imported-prompt">
                  Delete all {importedCount} imported? Cannot be undone.
                </span>
                <div className="expenses-plaid-delete-imported-actions">
                  <button
                    type="button"
                    className="expenses-plaid-delete-imported-btn expenses-plaid-delete-imported-cancel"
                    onClick={handleDeleteAllImportedCancel}
                    disabled={deleteImportedLoading}
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="expenses-plaid-delete-imported-btn"
                    onClick={() => void handleDeleteAllImportedSubmit()}
                    disabled={deleteImportedLoading}
                    aria-label={`Delete all ${importedCount} imported expenses`}
                  >
                    {deleteImportedLoading ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="expenses-plaid-delete-imported-btn"
                onClick={handleDeleteAllImportedConfirm}
                disabled={deleteImportedLoading}
                aria-label={`Delete all ${importedCount} imported expenses`}
              >
                Delete all imported expenses ({importedCount})
              </button>
            )}
          </div>
        )}
      </CollapsibleSection>
    );
  }

  if (sectionId === "expenses-taxes") {
    return (
      <CollapsibleSection
        sectionId="expenses-taxes"
        title={
          <>
            Taxes{" "}
            <span
              className="tests-page-section-count"
              aria-label="Tax documents count"
            >
              {taxDocuments.length} Docs
            </span>
          </>
        }
        collapsed={isSectionCollapsed("expenses-taxes")}
        onToggle={() => toggleSection("expenses-taxes")}
        sectionClassName="expenses-taxes-section"
        headingId="expenses-taxes-heading"
        headerTrailing={dragHandle}
      >
        <p className="expenses-taxes-desc">
          Upload tax documents, organize what they likely mean, and track filing
          readiness for this project.
        </p>
        <ProjectSectionGuard
          projectsLoaded={projectsLoaded}
          selectedProjectId={selectedProjectId ?? ""}
          message="Select a project to manage tax documents."
          variant="list"
        >
          <div className="expenses-taxes-actions">
            <input
              ref={taxUploadInputRef}
              type="file"
              multiple
              className="expenses-taxes-file-input"
              onChange={(event) => void handleTaxUpload(event)}
              accept=".pdf,.csv,.txt,.json,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"
              aria-label="Upload tax documents"
            />
            <button
              type="button"
              className="project-nav-add expenses-taxes-upload-btn"
              onClick={openTaxFilePicker}
              disabled={taxUploading}
              aria-busy={taxUploading}
            >
              {taxUploading ? "Processing…" : "Upload tax documents"}
            </button>
            {taxUploadError && (
              <p className="expenses-error-notice-text" role="alert">
                {taxUploadError}
              </p>
            )}
          </div>

          <div className="expenses-taxes-readiness">
            <p className="expenses-taxes-readiness-score">
              <strong>{taxReadinessScore}%</strong> {taxReadinessLabel}
            </p>
            <p className="expenses-taxes-readiness-meta">
              Checklist {taxChecklistCompleted}/{TAX_CHECKLIST_ITEMS.length}{" "}
              complete
            </p>
            {missingTaxCoverageLabels.length > 0 ? (
              <p className="expenses-taxes-readiness-missing">
                Missing: {missingTaxCoverageLabels.join(", ")}
              </p>
            ) : (
              <p className="expenses-taxes-readiness-missing">
                Core document categories detected. Run a final review before
                filing.
              </p>
            )}
          </div>

          <ul
            className="expenses-taxes-checklist"
            aria-label="Tax filing checklist"
          >
            {TAX_CHECKLIST_ITEMS.map((item) => (
              <li key={item.id} className="expenses-taxes-checklist-item">
                <label className="expenses-taxes-checklist-label">
                  <input
                    type="checkbox"
                    checked={taxChecklist[item.id]}
                    onChange={() => handleTaxChecklistToggle(item.id)}
                  />{" "}
                  {item.label}
                </label>
              </li>
            ))}
          </ul>

          {taxDocuments.length === 0 ? (
            <p className="tests-page-section-desc finances-empty-state-msg">
              No tax documents uploaded yet.
            </p>
          ) : (
            <ul
              className="expenses-taxes-doc-list"
              aria-label="Uploaded tax documents"
            >
              {taxDocuments.map((doc) => (
                <li key={doc.id} className="expenses-taxes-doc-item">
                  <div className="expenses-taxes-doc-header">
                    <div>
                      <p className="expenses-taxes-doc-name">{doc.fileName}</p>
                      <p className="expenses-taxes-doc-meta">
                        {taxKindLabel(doc.kind)} · {formatBytes(doc.sizeBytes)}
                        {doc.taxYear != null ? ` · ${doc.taxYear}` : ""}
                        {` · Uploaded ${new Date(doc.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="expenses-taxes-doc-actions">
                      {isAuthenticated() && (
                        <button
                          type="button"
                          className="expenses-plaid-disconnect-btn"
                          onClick={() => void handleTaxDownload(doc)}
                          aria-label={`Download ${doc.fileName}`}
                          title={`Download "${doc.fileName}"`}
                        >
                          Download
                        </button>
                      )}
                      <button
                        type="button"
                        className="features-list-remove"
                        onClick={() => void removeTaxDocument(doc.id)}
                        aria-label={`Remove ${doc.fileName}`}
                        title={`Remove "${doc.fileName}"`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                  <p className="expenses-taxes-doc-insight">
                    {taxDocInsight(doc.kind)}
                  </p>
                  {doc.textPreview && (
                    <p className="expenses-taxes-doc-preview">
                      <strong>Text preview:</strong> {doc.textPreview}
                    </p>
                  )}
                  <label className="expenses-taxes-notes-label">
                    Notes for filing
                    <textarea
                      className="expenses-input expenses-taxes-notes"
                      value={doc.notes}
                      spellCheck
                      onChange={(event) =>
                        setTaxDocuments((prev) =>
                          prev.map((item) =>
                            item.id === doc.id
                              ? { ...item, notes: event.target.value }
                              : item
                          )
                        )
                      }
                      onBlur={(event) =>
                        void updateTaxDocumentNotes(doc.id, event.target.value)
                      }
                      placeholder="Add notes (what it is, where it belongs, follow-ups needed)."
                      rows={2}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </ProjectSectionGuard>
      </CollapsibleSection>
    );
  }

  if (sectionId === "expenses-add-and-list") {
    const listControls =
      expenses.length > 0 ? (
        <div className="expenses-list-controls">
          <ExpensesDateFilterDropdown
            mode={dateFilterMode}
            filterDay={filterDay}
            filterDayOfMonth={filterDayOfMonth}
            filterMonth={filterMonth}
            filterYear={filterYear}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onModeChange={setDateFilterMode}
            onFilterDayChange={setFilterDay}
            onFilterDayOfMonthChange={setFilterDayOfMonth}
            onFilterMonthChange={setFilterMonth}
            onFilterYearChange={setFilterYear}
            onRangeStartChange={setRangeStart}
            onRangeEndChange={setRangeEnd}
            open={dateFilterOpen}
            onOpenChange={setDateFilterOpen}
          />
          <div className="expenses-list-search-wrap">
            <input
              id="expenses-list-search"
              type="search"
              value={expenseSearchQuery}
              onChange={(event) => setExpenseSearchQuery(event.target.value)}
              placeholder="Search Expenses"
              aria-label="Search expenses"
              className="expenses-input expenses-list-search"
            />
          </div>
        </div>
      ) : null;

    return (
      <CollapsibleSection
        sectionId="expenses-add-and-list"
        title={
          <>
            Expenses{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {categoryFilter
                ? `${filteredExpenses.length} of ${expenses.length} (${categoryFilter})`
                : expenseSearchQuery.trim()
                  ? `${filteredExpenses.length} of ${expenses.length}`
                  : dateFilterMode !== "all"
                    ? `${filteredExpenses.length} of ${expenses.length}`
                    : expenses.length}
            </span>
          </>
        }
        collapsed={isSectionCollapsed("expenses-add-and-list")}
        onToggle={() => toggleSection("expenses-add-and-list")}
        sectionClassName="expenses-add-section expenses-list-section"
        headerTrailing={dragHandle}
      >
        <ProjectSectionGuard
          projectsLoaded={projectsLoaded}
          selectedProjectId={selectedProjectId ?? ""}
          message="Select a project to add expenses."
          variant="add"
        >
          <form
            onSubmit={(event) => void addExpense(event)}
            className="expenses-form"
          >
            <div
              className="expenses-field expenses-field-date"
              ref={datePickerRef}
            >
              <label htmlFor="expenses-date-trigger">Date</label>
              <div className="expenses-date-control">
                <button
                  type="button"
                  id="expenses-date-trigger"
                  className="expenses-input expenses-date-trigger"
                  onClick={() => setDatePickerOpen((open) => !open)}
                  aria-haspopup="dialog"
                  aria-expanded={datePickerOpen}
                  aria-label="Choose date"
                >
                  {formatExpenseDateDisplay(date)}
                </button>
                {datePickerOpen && (
                  <CalendarPickerPopup
                    value={date}
                    onChange={(dateStr) => {
                      setDate(dateStr);
                      setDatePickerOpen(false);
                    }}
                    onClose={() => setDatePickerOpen(false)}
                    showToday
                  />
                )}
              </div>
            </div>
            <div className="expenses-field expenses-field-description">
              <label htmlFor="expenses-description">Description</label>
              <input
                id="expenses-description"
                ref={descriptionInputRef}
                type="text"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setAddExpenseError("");
                }}
                placeholder="What was this for?"
                aria-label="Description"
                className="expenses-input"
              />
            </div>
            <div className="expenses-field expenses-field-amount">
              <label htmlFor="expenses-amount">Amount ($)</label>
              <input
                id="expenses-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === "" || /^-?\d*\.?\d*$/.test(nextValue)) {
                    setAmount(nextValue);
                    setAddExpenseError("");
                  }
                }}
                placeholder="0.00"
                aria-label="Amount"
                className="expenses-input"
              />
            </div>
            <div className="expenses-field expenses-field-category">
              <label htmlFor="expenses-category-trigger">Category</label>
              <ExpenseCategoryDropdown
                ref={categoryDropdownRef}
                value={category}
                onChange={setCategory}
                categories={EXPENSE_CATEGORIES}
                open={categoryDropdownOpen}
                onOpenChange={setCategoryDropdownOpen}
                variant="form"
                listboxId="expenses-category-listbox"
                triggerAriaLabel="Category"
                triggerId="expenses-category-trigger"
              />
            </div>
            <button
              type="submit"
              className="project-nav-add expenses-add-btn"
              aria-label="Add Expense"
              title="Add Expense"
              disabled={!canAddExpense}
            >
              <IconPlus />
            </button>
          </form>
        </ProjectSectionGuard>
        {listControls}
        <ProjectSectionGuard
          projectsLoaded={projectsLoaded}
          selectedProjectId={selectedProjectId ?? ""}
          message="Select a project to see and manage expenses."
          variant="list"
        >
          {expenses.length === 0 ? (
            <p className="tests-page-section-desc finances-empty-state-msg">
              It's dark in here...
              <br />
              Turn the lights on by adding something.
            </p>
          ) : filteredExpenses.length === 0 ? (
            <p className="tests-page-section-desc finances-empty-state-msg">
              No expenses match your filters.
            </p>
          ) : (
            <div className="expenses-list-table">
              <div className="expenses-list-header" role="presentation">
                <button
                  type="button"
                  className={
                    "expenses-list-header-label" +
                    (sortBy === "date" ? " is-active" : "")
                  }
                  onClick={() => handleSort("date")}
                  aria-label={`Sort by date ${sortBy === "date" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                  title="Sort by Date"
                >
                  Date
                  {sortBy === "date" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </button>
                <button
                  type="button"
                  className={
                    "expenses-list-header-label" +
                    (sortBy === "description" ? " is-active" : "")
                  }
                  onClick={() => handleSort("description")}
                  aria-label={`Sort by description ${sortBy === "description" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                  title="Sort by Description"
                >
                  Description
                  {sortBy === "description"
                    ? sortDir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
                <button
                  type="button"
                  className={
                    "expenses-list-header-label expenses-list-header-amount" +
                    (sortBy === "amount" ? " is-active" : "")
                  }
                  onClick={() => handleSort("amount")}
                  aria-label={`Sort by amount ${sortBy === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                  title="Sort by Amount"
                >
                  Amount
                  {sortBy === "amount" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </button>
                <button
                  type="button"
                  className={
                    "expenses-list-header-label expenses-list-header-category" +
                    (sortBy === "category" ? " is-active" : "")
                  }
                  onClick={() => handleSort("category")}
                  aria-label={`Sort by category ${sortBy === "category" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                  title="Sort by Category"
                >
                  Category
                  {sortBy === "category"
                    ? sortDir === "asc"
                      ? " ↑"
                      : " ↓"
                    : ""}
                </button>
                <span
                  className="expenses-list-header-spacer"
                  aria-hidden="true"
                />
              </div>
              <ul className="expenses-list" role="list">
                {filteredExpenses.map((item) => (
                  <li key={item.id} className="expenses-item">
                    <span className="expenses-item-date">
                      {formatExpenseDateDisplay(item.date)}
                    </span>
                    {editingDescriptionId === item.id ? (
                      <input
                        type="text"
                        value={editingDescriptionValue}
                        onChange={(event) =>
                          setEditingDescriptionValue(event.target.value)
                        }
                        onBlur={() =>
                          void saveExpenseDescription(
                            item.id,
                            editingDescriptionValue
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          } else if (event.key === "Escape") {
                            cancelEditingDescription();
                          }
                        }}
                        autoFocus
                        aria-label="Edit description for expense"
                        className="expenses-item-description-input"
                      />
                    ) : (
                      <span
                        className="expenses-item-description expenses-item-description-editable"
                        role="button"
                        tabIndex={0}
                        onClick={() => startEditingDescription(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            startEditingDescription(item);
                          }
                        }}
                        title="Click to Edit Description"
                        aria-label={`Edit description: ${item.description ?? ""}`}
                      >
                        {item.description}
                      </span>
                    )}
                    <span className="expenses-item-amount">
                      {formatCurrency(item.amount)}
                    </span>
                    {editingCategoryId === item.id ? (
                      <ExpenseCategoryDropdown
                        ref={listCategoryDropdownRef}
                        value={item.category || "Other"}
                        onChange={(nextCategory) => {
                          void updateExpenseCategory(item.id, nextCategory);
                          setEditingCategoryId(null);
                        }}
                        categories={EXPENSE_CATEGORIES}
                        open={true}
                        onOpenChange={(open) => {
                          if (!open) setEditingCategoryId(null);
                        }}
                        variant="inline"
                        listboxId={`expenses-list-category-listbox-${item.id}`}
                        triggerAriaLabel={`Edit category: ${item.category || "Other"}`}
                        title="Click to Edit Category"
                      />
                    ) : (
                      <button
                        type="button"
                        className="expenses-category-btn"
                        onClick={() => setEditingCategoryId(item.id)}
                        title="Click to Edit Category"
                        aria-label={`Edit category: ${item.category || "Other"}`}
                      >
                        {item.category}
                      </button>
                    )}
                    <button
                      type="button"
                      className="features-list-remove"
                      onClick={() => void removeExpense(item.id)}
                      aria-label={`Remove ${item.description}`}
                      title={`Remove "${item.description}"`}
                    >
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ProjectSectionGuard>
      </CollapsibleSection>
    );
  }

  return null;
}
