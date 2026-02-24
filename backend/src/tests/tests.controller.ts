import { Body, Controller, Get, Post, Query, Sse } from "@nestjs/common";
import { Observable } from "rxjs";
import { MessageEvent } from "@nestjs/common";
import { TestsService } from "./tests.service";

@Controller("tests")
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post("run-ui")
  async runUi(@Body() body: { grep: string }) {
    const grep = typeof body?.grep === "string" ? body.grep.trim() : "";
    if (!grep) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
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
    return this.testsService.runUiTestStream(grep ?? "");
  }

  @Post("run-api")
  async runApi(@Body() body: { testNamePattern: string }) {
    const pattern =
      typeof body?.testNamePattern === "string"
        ? body.testNamePattern.trim()
        : "";
    return this.testsService.runApiTest(pattern);
  }
}
