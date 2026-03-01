import React from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import type { Expense } from "../api/client";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";
import { EXPENSE_CATEGORIES } from "../constants";

export type CreateExpenseForm = {
  description: string;
  amount: string;
  date: string;
  category: string;
};

export type ExpensesTabProps = {
  createExpenseForm: CreateExpenseForm;
  setCreateExpenseForm: React.Dispatch<React.SetStateAction<CreateExpenseForm>>;
  creatingExpense: boolean;
  selectedProjectId: string;
  handleCreateExpense: () => Promise<void>;
  expensesTotal: number;
  expenseSearchQuery: string;
  setExpenseSearchQuery: (v: string) => void;
  expenseCategoryFilter: string;
  setExpenseCategoryFilter: (v: string) => void;
  expenses: Expense[];
  expensesLoading: boolean;
  expensesError: string;
  filteredExpenses: Expense[];
  editingExpenseId: string;
  expenseEditDescription: string;
  setExpenseEditDescription: (v: string) => void;
  expenseEditAmount: string;
  setExpenseEditAmount: (v: string) => void;
  expenseEditDate: string;
  setExpenseEditDate: (v: string) => void;
  expenseEditCategory: string;
  setExpenseEditCategory: (v: string) => void;
  savingExpenseEdit: boolean;
  handleSaveExpenseEdit: () => Promise<void>;
  deletingExpenseId: string;
  beginEditExpense: (expense: Expense) => void;
  handleDeleteExpense: (id: string) => Promise<void>;
  onCancelExpenseEdit: () => void;
};

export function ExpensesTab({
  createExpenseForm,
  setCreateExpenseForm,
  creatingExpense,
  selectedProjectId,
  handleCreateExpense,
  expensesTotal,
  expenseSearchQuery,
  setExpenseSearchQuery,
  expenseCategoryFilter,
  setExpenseCategoryFilter,
  expenses,
  expensesLoading,
  expensesError,
  filteredExpenses,
  editingExpenseId,
  expenseEditDescription,
  setExpenseEditDescription,
  expenseEditAmount,
  setExpenseEditAmount,
  expenseEditDate,
  setExpenseEditDate,
  expenseEditCategory,
  setExpenseEditCategory,
  savingExpenseEdit,
  handleSaveExpenseEdit,
  deletingExpenseId,
  beginEditExpense,
  handleDeleteExpense,
  onCancelExpenseEdit,
}: ExpensesTabProps) {
  const s = appStyles;
  return (
    <View style={s.stackFill}>
      <AppCard title="Create Expense">
        <View style={s.stack}>
          <TextInput
            style={s.input}
            value={createExpenseForm.description}
            onChangeText={(value) =>
              setCreateExpenseForm((current) => ({ ...current, description: value }))
            }
            placeholder="Description"
            placeholderTextColor="#94a3b8"
          />
          <View style={s.inlineRow}>
            <TextInput
              style={[s.input, s.flex]}
              value={createExpenseForm.amount}
              onChangeText={(value) =>
                setCreateExpenseForm((current) => ({ ...current, amount: value }))
              }
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={[s.input, s.flex]}
              value={createExpenseForm.date}
              onChangeText={(value) =>
                setCreateExpenseForm((current) => ({ ...current, date: value }))
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <TextInput
            style={s.input}
            value={createExpenseForm.category}
            onChangeText={(value) =>
              setCreateExpenseForm((current) => ({ ...current, category: value }))
            }
            placeholder="Category"
            placeholderTextColor="#94a3b8"
          />
          <View style={s.chipWrap}>
            {EXPENSE_CATEGORIES.map((category) => (
              <Pressable
                key={`create-expense-category-${category}`}
                style={[
                  s.chip,
                  createExpenseForm.category === category ? s.chipActive : null,
                ]}
                onPress={() =>
                  setCreateExpenseForm((current) => ({ ...current, category }))
                }
              >
                <Text
                  style={[
                    s.chipText,
                    createExpenseForm.category === category ? s.chipTextActive : null,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
          <AppButton
            label={creatingExpense ? "Saving..." : "Save Expense"}
            disabled={creatingExpense || !selectedProjectId}
            onPress={() => handleCreateExpense().catch(() => {})}
          />
        </View>
      </AppCard>

      <AppCard title={`Expenses ($${expensesTotal.toFixed(2)})`} style={s.fillCard}>
        <View style={s.stack}>
          <TextInput
            style={s.input}
            value={expenseSearchQuery}
            onChangeText={setExpenseSearchQuery}
            placeholder="Search expenses"
            placeholderTextColor="#94a3b8"
          />
          <View style={s.chipWrap}>
            <Pressable
              style={[s.chip, expenseCategoryFilter === "all" ? s.chipActive : null]}
              onPress={() => setExpenseCategoryFilter("all")}
            >
              <Text
                style={[
                  s.chipText,
                  expenseCategoryFilter === "all" ? s.chipTextActive : null,
                ]}
              >
                All ({expenses.length})
              </Text>
            </Pressable>
            {EXPENSE_CATEGORIES.map((category) => {
              const count = expenses.filter((e) => e.category === category).length;
              return (
                <Pressable
                  key={`expense-filter-${category}`}
                  style={[
                    s.chip,
                    expenseCategoryFilter === category ? s.chipActive : null,
                  ]}
                  onPress={() => setExpenseCategoryFilter(category)}
                >
                  <Text
                    style={[
                      s.chipText,
                      expenseCategoryFilter === category ? s.chipTextActive : null,
                    ]}
                  >
                    {category} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {expensesLoading ? <ActivityIndicator /> : null}
        {expensesError ? <Text style={s.errorText}>{expensesError}</Text> : null}
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContainer}
          renderItem={({ item }) => (
            <View
              style={[
                s.listItem,
                item.id === editingExpenseId ? s.listItemSelected : null,
              ]}
            >
              {item.id === editingExpenseId ? (
                <View style={s.stack}>
                  <TextInput
                    style={s.input}
                    value={expenseEditDescription}
                    onChangeText={setExpenseEditDescription}
                    placeholder="Description"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={s.input}
                    value={expenseEditAmount}
                    onChangeText={setExpenseEditAmount}
                    keyboardType="decimal-pad"
                    placeholder="Amount"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={s.input}
                    value={expenseEditDate}
                    onChangeText={setExpenseEditDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={s.input}
                    value={expenseEditCategory}
                    onChangeText={setExpenseEditCategory}
                    placeholder="Category"
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={s.chipWrap}>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <Pressable
                        key={`edit-expense-${item.id}-${cat}`}
                        style={[
                          s.chip,
                          expenseEditCategory === cat ? s.chipActive : null,
                        ]}
                        onPress={() => setExpenseEditCategory(cat)}
                      >
                        <Text
                          style={[
                            s.chipText,
                            expenseEditCategory === cat ? s.chipTextActive : null,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.inlineRowWrap}>
                    <AppButton
                      label={savingExpenseEdit ? "Saving..." : "Save"}
                      disabled={savingExpenseEdit}
                      onPress={() => handleSaveExpenseEdit().catch(() => {})}
                    />
                    <AppButton
                      label="Cancel"
                      variant="secondary"
                      onPress={onCancelExpenseEdit}
                    />
                    <AppButton
                      label={deletingExpenseId === item.id ? "Deleting..." : "Delete"}
                      variant="secondary"
                      disabled={deletingExpenseId === item.id}
                      onPress={() => handleDeleteExpense(item.id).catch(() => {})}
                    />
                  </View>
                </View>
              ) : (
                <View style={s.stack}>
                  <Text style={s.listItemTitle}>{item.description}</Text>
                  <Text style={s.valueText}>
                    ${Number(item.amount).toFixed(2)}
                  </Text>
                  <Text style={s.listItemMeta}>
                    {item.category} • {item.date}
                  </Text>
                  <View style={s.inlineRowWrap}>
                    <AppButton
                      label="Edit"
                      variant="secondary"
                      onPress={() => beginEditExpense(item)}
                    />
                    <AppButton
                      label={deletingExpenseId === item.id ? "Deleting..." : "Delete"}
                      variant="secondary"
                      disabled={deletingExpenseId === item.id}
                      onPress={() => handleDeleteExpense(item.id).catch(() => {})}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={s.subtle}>
              {expenseSearchQuery.trim() || expenseCategoryFilter !== "all"
                ? "No matching expenses."
                : "No expenses yet."}
            </Text>
          }
        />
      </AppCard>
    </View>
  );
}
