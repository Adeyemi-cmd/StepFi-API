#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// Types
interface DocPage {
  slug: string;
  title: string;
  section: string;
  path: string;
  content: string;
}

interface DocSection {
  name: string;
  description: string;
  pages: { slug: string; title: string }[];
}

// Documentation indexer
class DocsIndexer {
  private pages: Map<string, DocPage> = new Map();
  private sections: Map<string, DocSection> = new Map();
  private docsPath: string;

  constructor(docsPath: string) {
    this.docsPath = docsPath;
    this.indexDocs();
  }

  private extractTitle(content: string, filename: string): string {
    // Try to extract title from first H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    // Fallback to filename
    return filename
      .replace(/\.md$/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private getSectionInfo(sectionName: string): string {
    const descriptions: Record<string, string> = {
      architecture: "System architecture, blockchain integration, and database design",
      setup: "Installation guides and configuration",
      development: "Development standards and coding guidelines",
      api: "API endpoint documentation and reference",
      root: "Project overview and general documentation",
    };
    return descriptions[sectionName] || `${sectionName} documentation`;
  }

  private indexDocs(): void {
    // Index docs/ directory
    this.indexDirectory(this.docsPath, "");

    // Index root-level documentation files
    const rootDocsPath = path.dirname(this.docsPath);
    const rootFiles = ["README.md", "CONTRIBUTING.md", "ROADMAP.md", "SECURITY.md"];

    for (const file of rootFiles) {
      const filePath = path.join(rootDocsPath, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const slug = file.toLowerCase().replace(/\.md$/, "");
        const title = this.extractTitle(content, file);

        this.pages.set(slug, {
          slug,
          title,
          section: "root",
          path: filePath,
          content,
        });

        // Add to root section
        if (!this.sections.has("root")) {
          this.sections.set("root", {
            name: "root",
            description: this.getSectionInfo("root"),
            pages: [],
          });
        }
        this.sections.get("root")!.pages.push({ slug, title });
      }
    }
  }

  private indexDirectory(dirPath: string, sectionPrefix: string): void {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const sectionName = entry.name;
        const newPrefix = sectionPrefix ? `${sectionPrefix}/${sectionName}` : sectionName;

        // Create section
        this.sections.set(sectionName, {
          name: sectionName,
          description: this.getSectionInfo(sectionName),
          pages: [],
        });

        this.indexDirectory(fullPath, newPrefix);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const filename = entry.name.replace(/\.mdx?$/, "");
        const slug = sectionPrefix ? `${sectionPrefix}/${filename}` : filename;
        const section = sectionPrefix.split("/")[0] || "root";
        const title = this.extractTitle(content, entry.name);

        this.pages.set(slug, {
          slug,
          title,
          section,
          path: fullPath,
          content,
        });

        // Add page to section
        if (this.sections.has(section)) {
          this.sections.get(section)!.pages.push({ slug, title });
        }
      }
    }
  }

  searchDocs(query: string): DocPage[] {
    const queryLower = query.toLowerCase();
    const results: { page: DocPage; score: number }[] = [];

    for (const page of this.pages.values()) {
      let score = 0;

      // Title match (highest priority)
      if (page.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Slug match
      if (page.slug.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Content match
      const contentLower = page.content.toLowerCase();
      const matches = contentLower.split(queryLower).length - 1;
      score += Math.min(matches, 10); // Cap content matches

      if (score > 0) {
        results.push({ page, score });
      }
    }

    // Sort by score (descending) and return top 10
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => r.page);
  }

  getDocPage(slug: string): DocPage | undefined {
    return this.pages.get(slug);
  }

  listSections(): DocSection[] {
    return Array.from(this.sections.values());
  }
}

// MCP Server
async function main() {
  // Determine docs path (relative to this file when running from mcp/)
  const mcpDir = process.cwd();
  let docsPath = path.join(mcpDir, "..", "docs");

  // If running from project root
  if (!fs.existsSync(docsPath)) {
    docsPath = path.join(mcpDir, "docs");
  }

  // Fallback to absolute path for development
  if (!fs.existsSync(docsPath)) {
    docsPath = path.resolve(__dirname, "..", "..", "docs");
  }

  if (!fs.existsSync(docsPath)) {
    console.error("Could not find docs directory. Please run from project root or mcp/ directory.");
    process.exit(1);
  }

  const indexer = new DocsIndexer(docsPath);

  const server = new Server(
    {
      name: "stepfi-docs",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_docs",
        description:
          "Search StepFi API documentation by query. Returns matching documentation pages with their titles, slugs, and relevant excerpts.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Search query to find in documentation",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_doc_page",
        description:
          "Get the full content of a documentation page by its slug. Use list_doc_sections first to see available pages.",
        inputSchema: {
          type: "object" as const,
          properties: {
            slug: {
              type: "string",
              description:
                "The slug/path of the documentation page (e.g., 'architecture/overview', 'setup/installation')",
            },
          },
          required: ["slug"],
        },
      },
      {
        name: "list_doc_sections",
        description:
          "List all available documentation sections and their pages. Use this to discover what documentation is available.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "search_docs": {
        const query = (args as { query: string }).query;
        if (!query) {
          throw new McpError(ErrorCode.InvalidParams, "Query parameter is required");
        }

        const results = indexer.searchDocs(query);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No documentation found for query: "${query}"`,
              },
            ],
          };
        }

        const formattedResults = results.map((page) => {
          // Extract relevant excerpt
          const queryLower = query.toLowerCase();
          const contentLower = page.content.toLowerCase();
          const matchIndex = contentLower.indexOf(queryLower);

          let excerpt = "";
          if (matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 100);
            const end = Math.min(page.content.length, matchIndex + query.length + 100);
            excerpt = "..." + page.content.slice(start, end).replace(/\n/g, " ") + "...";
          } else {
            excerpt = page.content.slice(0, 200).replace(/\n/g, " ") + "...";
          }

          return `## ${page.title}\n- **Slug:** ${page.slug}\n- **Section:** ${page.section}\n- **Excerpt:** ${excerpt}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `# Search Results for "${query}"\n\nFound ${results.length} matching page(s):\n\n${formattedResults.join("\n\n---\n\n")}`,
            },
          ],
        };
      }

      case "get_doc_page": {
        const slug = (args as { slug: string }).slug;
        if (!slug) {
          throw new McpError(ErrorCode.InvalidParams, "Slug parameter is required");
        }

        const page = indexer.getDocPage(slug);

        if (!page) {
          throw new McpError(ErrorCode.InvalidParams, `Documentation page not found: "${slug}"`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `# ${page.title}\n\n**Section:** ${page.section}\n**Slug:** ${page.slug}\n\n---\n\n${page.content}`,
            },
          ],
        };
      }

      case "list_doc_sections": {
        const sections = indexer.listSections();

        const formattedSections = sections.map((section) => {
          const pageList = section.pages.map((p) => `  - **${p.title}** (\`${p.slug}\`)`).join("\n");
          return `## ${section.name.charAt(0).toUpperCase() + section.name.slice(1)}\n${section.description}\n\n**Pages:**\n${pageList}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `# StepFi API Documentation\n\nAvailable documentation sections:\n\n${formattedSections.join("\n\n---\n\n")}`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StepFi Docs MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
