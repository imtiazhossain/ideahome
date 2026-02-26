import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { MessageEvent } from "@nestjs/common";
import { TestsService } from "./tests.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

@Controller("tests")
@UseGuards(JwtAuthGuard)
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  private ensureTestsExecutionEnabled(): void {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "Test execution endpoints are disabled in production."
      );
    }
    if (process.env.ENABLE_TEST_ENDPOINTS === "true") return;
    throw new ForbiddenException(
      "Test execution endpoints are disabled. Set ENABLE_TEST_ENDPOINTS=true for local development."
    );
  }

  @Post("run-ui")
  async runUi(@Body() body: { grep: string }) {
    this.ensureTestsExecutionEnabled();
    const grep = typeof body?.grep === "string" ? body.grep.trim() : "";
    if (!grep) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      };
    }
    if (process.env.VERCEL || process.env.USE_BUILTIN_API) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput:
          "UI tests (Playwright) are not available on Vercel. Run them locally with pnpm dev:backend.",
      };
    }
    return this.testsService.runUiTest(grep);
  }

  /**
   * SSE stream: run UI test with live browser screenshots.
   * GET /tests/run-ui-stream?grep=test%20name
   */
  @Sse("run-ui-stream")
  runUiStream(@Query("grep") grep: string): Observable<MessageEvent> {
    this.ensureTestsExecutionEnabled();
    if (process.env.VERCEL || process.env.USE_BUILTIN_API) {
      return new Observable((sub) => {
        sub.next({
          data: JSON.stringify({
            type: "error",
            data: "UI tests (Playwright) are not available on Vercel. Run them locally.",
          }),
        } as MessageEvent);
        sub.complete();
      });
    }
    return this.testsService.runUiTestStream(grep ?? "");
  }

  @Post("run-api")
  async runApi(@Body() body: { testNamePattern: string }) {
    this.ensureTestsExecutionEnabled();
    const pattern =
      typeof body?.testNamePattern === "string"
        ? body.testNamePattern.trim()
        : "";
    if (process.env.VERCEL || process.env.USE_BUILTIN_API) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput:
          "API tests are not available on Vercel. Run them locally with pnpm test:e2e.",
      };
    }
    return this.testsService.runApiTest(pattern);
  }
}
