# StepFi Docs MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes StepFi API documentation to AI assistants like Claude, ChatGPT, and Cursor.

## Features

This MCP server provides three tools for AI assistants to access project documentation:

| Tool | Description |
|------|-------------|
| `search_docs` | Search documentation by query, returns matching pages with excerpts |
| `get_doc_page` | Get the full content of a documentation page by its slug |
| `list_doc_sections` | List all available documentation sections and pages |

## Installation

### From Project Root

```bash
cd mcp
npm install
npm run build
```

### Quick Test

```bash
cd mcp
npx ts-node src/index.ts
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "stepfi-docs": {
      "command": "node",
      "args": ["/absolute/path/to/StepFi-API/mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

Or using npx (after publishing):

```json
{
  "mcpServers": {
    "stepfi-docs": {
      "command": "npx",
      "args": ["-y", "@stepfi/docs-mcp-server"],
      "env": {}
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project):

```json
{
  "mcpServers": {
    "stepfi-docs": {
      "command": "node",
      "args": ["./mcp/dist/index.js"]
    }
  }
}
```

Or in Cursor's global settings:

1. Open Cursor Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "MCP"
3. Add the server configuration:

```json
{
  "stepfi-docs": {
    "command": "node",
    "args": ["/absolute/path/to/StepFi-API/mcp/dist/index.js"]
  }
}
```

### VS Code with Claude Code Extension

Add to your VS Code settings (`.vscode/mcp.json`):

```json
{
  "servers": {
    "stepfi-docs": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/dist/index.js"]
    }
  }
}
```

Or in your VS Code `settings.json`:

```json
{
  "claude.mcpServers": {
    "stepfi-docs": {
      "command": "node",
      "args": ["./mcp/dist/index.js"]
    }
  }
}
```

### Continue.dev

Add to your Continue config (`~/.continue/config.json`):

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/absolute/path/to/StepFi-API/mcp/dist/index.js"]
        }
      }
    ]
  }
}
```

## Usage Examples

Once configured, you can ask your AI assistant:

- "Search the StepFi docs for authentication"
- "Show me the API endpoints documentation"
- "List all available documentation sections"
- "Get the installation guide"

### Tool Examples

**Search documentation:**
```
search_docs({ query: "authentication" })
```

**Get a specific page:**
```
get_doc_page({ slug: "architecture/overview" })
```

**List all sections:**
```
list_doc_sections()
```

## Available Documentation

The server indexes the following documentation:

### Sections

- **Architecture** - System design, blockchain integration, database schema
- **Setup** - Installation guides, environment variables, Supabase setup
- **Development** - Coding standards, controllers, services, DTOs, testing
- **API** - Endpoint documentation and reference
- **Root** - README, Contributing, Roadmap, Security

### Slugs Format

Documentation pages use the following slug format:
- `section/page-name` (e.g., `architecture/overview`, `setup/installation`)
- Root files use just the filename (e.g., `readme`, `contributing`)

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Run Locally

```bash
npm start
```

## Troubleshooting

### Server not starting

1. Ensure you've run `npm install` and `npm run build`
2. Check that the path to `dist/index.js` is correct
3. Verify Node.js v18+ is installed

### Documentation not found

The server looks for docs in these locations (in order):
1. `../docs` (from mcp directory)
2. `./docs` (from project root)
3. Compiled path resolution

Ensure you're running from either the project root or the `mcp/` directory.

### Logs

The server logs to stderr. Check your AI assistant's MCP logs for debugging:
- Claude Desktop: Check the Claude logs
- Cursor: Check the Output panel > MCP
- VS Code: Check the Output panel

## License

MIT - See the main project license.

## Related

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [StepFi API Documentation](../docs/README.md)
