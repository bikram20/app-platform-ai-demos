import express from "express";
import cors from "cors";
import { handleSSE, handleSSEMessage } from "./routes/sse.js";
import { handleMCP } from "./routes/mcp.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
	res.json({ 
		message: "MCP Calculator Server is running",
		endpoints: {
			mcp: "/mcp",
			sse: "/sse",
			sseMessage: "/sse/message"
		}
	});
});

// MCP endpoint
app.post("/mcp", handleMCP);

// SSE endpoints
app.get("/sse", handleSSE);
app.post("/sse/message", handleSSEMessage);

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
	console.error("Server error:", err);
	res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 MCP Calculator Server running on port ${PORT}`);
	console.log(`📍 Endpoints:`);
	console.log(`   Health: http://localhost:${PORT}/`);
	console.log(`   MCP: http://localhost:${PORT}/mcp`);
	console.log(`   SSE: http://localhost:${PORT}/sse`);
});
