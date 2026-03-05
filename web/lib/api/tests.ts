import { pathTestsRunApi, pathTestsRunUi } from "@ideahome/shared";
import type {
  RunApiTestInput,
  RunApiTestResult as SharedRunApiTestResult,
  RunUiTestInput,
  RunUiTestResult as SharedRunUiTestResult,
} from "@ideahome/shared";
import { requestJson } from "./http";

export type RunUiTestResult = SharedRunUiTestResult;
export type RunApiTestResult = SharedRunApiTestResult;

export async function runUiTest(grep: string): Promise<RunUiTestResult> {
  const body: RunUiTestInput = { grep };
  return requestJson<RunUiTestResult>(pathTestsRunUi(), {
    method: "POST",
    body,
    errorMessage: "Failed to run UI test",
  });
}

export async function runApiTest(
  testNamePattern: string
): Promise<RunApiTestResult> {
  const body: RunApiTestInput = { testNamePattern };
  return requestJson<RunApiTestResult>(pathTestsRunApi(), {
    method: "POST",
    body,
    errorMessage: "Failed to run API test",
  });
}
