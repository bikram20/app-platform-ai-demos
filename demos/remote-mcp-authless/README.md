# MCP Calculator Server for DigitalOcean App Platform

This is a Node.js Express server that implements the Model Context Protocol (MCP) with simple calculator tools. It's designed to run on DigitalOcean App Platform.

## Features

- **Add Tool**: Simple addition of two numbers
- **Calculate Tool**: Basic arithmetic operations (add, subtract, multiply, divide)
- **SSE Support**: Server-Sent Events for real-time communication
- **CORS Enabled**: Cross-origin requests supported
- **Health Check**: Basic health endpoint

## Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   The server will start on `http://localhost:3000`

3. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

### Available Endpoints

- **Health Check**: `GET /` - Server status and available endpoints
- **MCP Protocol**: `POST /mcp` - Direct MCP protocol requests (Streamable HTTP)
- **SSE Stream**: `GET /sse` - Server-Sent Events for real-time communication
- **SSE Messages**: `POST /sse/message` - Send messages to SSE stream

## Technical Architecture: MCP vs SSE

### 🔄 **SSE Endpoint (`/sse`)**: Real-time Streaming
**Key Characteristics:**
- **Headers**: `Content-Type: text/event-stream` + `Connection: keep-alive`
- **Pattern**: Persistent connection, streaming responses
- **Format**: `data: {JSON}\n\n` (SSE protocol)
- **Usage**: Long-lived connections for real-time communication

### 📡 **MCP Endpoint (`/mcp`)**: Streamable HTTP
**Key Characteristics:**
- **Headers**: `Content-Type: application/json`
- **Pattern**: Request-response, connection closes after response
- **Format**: Standard JSON object
- **Usage**: Traditional HTTP API calls

The **`Content-Type: text/event-stream`** header is what makes browsers treat the connection as SSE, keeping it open for streaming data.

## API Usage Examples

### Direct MCP Endpoint Testing

#### Test the Add Tool
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 5, "b": 3}
    }
  }'
```

#### Test the Calculator Tool
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {"operation": "multiply", "a": 4, "b": 7}
    }
  }'
```

#### List Available Tools
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list",
    "params": {}
  }'
```

## SSE Testing Guide

### Step 1: Establish SSE Connection

In **Terminal 1**, start an SSE connection:
```bash
curl -N http://localhost:3000/sse
```

You'll see:
```
data: {"type":"connection","status":"connected","connectionId":"conn_1_1234567890","message":"MCP Calculator Server connected. Send tool calls to /sse/message with your connectionId."}

data: {"type":"ping","timestamp":"2025-01-15T10:30:00.000Z"}
```

### Step 2: Send Tool Calls via SSE

In **Terminal 2**, send tool calls while keeping Terminal 1 open:

#### Test Add Tool via SSE
```bash
curl -X POST http://localhost:3000/sse/message \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 10, "b": 5}
    }
  }'
```

**Terminal 1 will show:**
```
data: {"type":"response","id":"req_1234567890","result":{"content":[{"type":"text","text":"15"}]}}
```

#### Test Calculator Tool via SSE
```bash
curl -X POST http://localhost:3000/sse/message \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {"operation": "multiply", "a": 7, "b": 8}
    }
  }'
```

**Terminal 1 will show:**
```
data: {"type":"response","id":"req_1234567891","result":{"content":[{"type":"text","text":"56"}]}}
```

#### List Tools via SSE
```bash
curl -X POST http://localhost:3000/sse/message \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list",
    "params": {}
  }'
```

**Terminal 1 will show:**
```
data: {"type":"response","id":"req_1234567892","result":{"tools":[{"name":"add","description":"Add two numbers",...}]}}
```

### Step 3: Advanced SSE Testing

#### Multiple Connections
You can have multiple SSE connections. Each gets a unique `connectionId`.

#### Connection ID Targeting
If you have multiple connections, specify which one to target:
```bash
curl -X POST http://localhost:3000/sse/message \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "conn_1_1234567890",
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 20, "b": 30}
    }
  }'
```

**If no `connectionId` is specified, it uses the most recent connection.**

## Deployment to DigitalOcean App Platform

### Using the Web Console

1. **Connect Repository**: Link your GitHub/GitLab repository
2. **Configure Build Settings**:
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
3. **Environment Variables**:
   - `PORT` is automatically provided by App Platform
   - Add any custom variables from `env.example`
4. **Deploy**: App Platform will automatically build and deploy

### Environment Variables

Copy `env.example` to `.env` for local development:
```bash
cp env.example .env
```

For production, configure these in the App Platform console:
- `PORT` (automatically provided)
- Any custom configuration variables

## Connect to MCP Clients

### Claude Desktop

To connect from Claude Desktop using [mcp-remote](https://www.npmjs.com/package/mcp-remote):

1. Install mcp-remote: `npm install -g mcp-remote`
2. Update Claude Desktop config (Settings > Developer > Edit Config):

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://your-app.ondigitalocean.app/sse"
      ]
    }
  }
}
```

3. Restart Claude Desktop

### Other MCP Clients

Use the SSE endpoint: `http://your-app.ondigitalocean.app/sse`

## Customizing

To add your own MCP tools:

1. **Edit `src/mcp-server.ts`**: Add new tools in the `initializeTools()` method
2. **Update Routes**: Modify `src/routes/mcp.ts` and `src/routes/sse.ts` for custom protocol handling
3. **Test Locally**: Use `npm run dev` to test changes
4. **Deploy**: Push to your repository for automatic deployment

## Project Structure

```
src/
├── index.ts          # Express server entry point
├── mcp-server.ts     # MCP server with calculator tools
├── routes/
│   ├── mcp.ts        # MCP protocol handler (Streamable HTTP)
│   └── sse.ts        # Server-Sent Events handler (Real-time streaming)
└── types/            # TypeScript type definitions
```

## Development

- **Type Check**: `npm run type-check`
- **Watch Mode**: `npm run dev` (auto-restarts on changes)
