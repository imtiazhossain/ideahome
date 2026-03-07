import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as api from "./api.js";

const server = new Server(
  {
    name: "ideahome-bulby",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_projects",
        description: "List all accessible projects in IdeaHome.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_project_lists",
        description:
          "Get the active items (todos, ideas, features, bugs) for a given IdeaHome project.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "The ID of the project to retrieve lists for.",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "add_item",
        description:
          "Add a new item (todo, idea, feature, bug) to a project in IdeaHome.",
        inputSchema: {
          type: "object",
          properties: {
            listType: {
              type: "string",
              description: "Which list to add to.",
              enum: ["todos", "ideas", "features", "bugs"],
            },
            projectId: {
              type: "string",
              description: "The ID of the project.",
            },
            name: {
              type: "string",
              description: "The text/name of the new item.",
            },
          },
          required: ["listType", "projectId", "name"],
        },
      },
      {
        name: "get_bulby_memory",
        description:
          "Get the current user's preferences, rules, and memory for Bulby.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_weather",
        description:
          "Get real-time weather for a given location (city, region, or country). Always use this tool when the user asks about weather for a specific place. Never guess or fabricate weather data.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city or place name to get weather for, e.g. \"Houston Texas\" or \"London UK\".",
            },
          },
          required: ["location"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_projects") {
      const projects = await api.getProjects();
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    }

    if (name === "get_project_lists") {
      const { projectId } = args as { projectId: string };
      if (!projectId) {
        throw new Error("Missing projectId argument");
      }
      const lists = await api.getProjectLists(projectId);
      return {
        content: [{ type: "text", text: JSON.stringify(lists, null, 2) }],
      };
    }

    if (name === "add_item") {
      const {
        listType,
        projectId,
        name: itemName,
      } = args as {
        listType: "todos" | "ideas" | "features" | "bugs";
        projectId: string;
        name: string;
      };
      if (!listType || !projectId || !itemName) {
        throw new Error("Missing required arguments");
      }
      const result = await api.addItem(listType, projectId, itemName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_bulby_memory") {
      const memory = await api.getBulbyMemory();
      return {
        content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
      };
    }

    if (name === "get_weather") {
      const { location } = args as { location: string };
      if (!location?.trim()) {
        throw new Error("Missing location argument");
      }
      const weather = await api.getWeather(location);
      return {
        content: [{ type: "text", text: JSON.stringify(weather, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bulby MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
