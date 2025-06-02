import { Request, Response } from "express";
import { CalculatorMCPServer } from "../mcp-server.js";

const mcpServer = new CalculatorMCPServer();

// In-memory storage for active SSE connections
const activeConnections = new Map<string, Response>();
let connectionCounter = 0;

export async function handleSSE(req: Request, res: Response) {
	// Generate unique connection ID
	const connectionId = `conn_${++connectionCounter}_${Date.now()}`;
	
	// Set SSE headers
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
	});

	// Store this connection
	activeConnections.set(connectionId, res);
	
	// Send connection established message with connection ID
	res.write(`data: ${JSON.stringify({
		type: "connection",
		status: "connected",
		connectionId: connectionId,
		message: "MCP Calculator Server connected. Send tool calls to /sse/message with your connectionId."
	})}\n\n`);

	// Keep alive with periodic pings
	const keepAlive = setInterval(() => {
		if (activeConnections.has(connectionId)) {
			res.write(`data: ${JSON.stringify({
				type: "ping",
				timestamp: new Date().toISOString()
			})}\n\n`);
		}
	}, 30000);

	// Handle client disconnection
	const cleanup = () => {
		clearInterval(keepAlive);
		activeConnections.delete(connectionId);
		console.log(`SSE connection ${connectionId} closed`);
	};

	req.on("close", cleanup);
	req.on("aborted", cleanup);
	
	console.log(`SSE connection ${connectionId} established`);
}

export async function handleSSEMessage(req: Request, res: Response) {
	try {
		const { method, params, connectionId } = req.body;
		
		// If no connectionId provided, try to send to the most recent connection
		let targetConnectionId = connectionId;
		if (!targetConnectionId && activeConnections.size > 0) {
			// Use the most recent connection
			targetConnectionId = Array.from(activeConnections.keys()).pop();
		}
		
		if (!targetConnectionId || !activeConnections.has(targetConnectionId)) {
			return res.status(400).json({ 
				error: "No active SSE connection found. Connect to /sse first." 
			});
		}
		
		const sseResponse = activeConnections.get(targetConnectionId)!;
		
		// Process MCP tool calls
		if (method === "tools/list") {
			const result = {
				type: "response",
				id: `req_${Date.now()}`,
				result: {
					tools: [
						{
							name: "add",
							description: "Add two numbers",
							inputSchema: {
								type: "object",
								properties: {
									a: { type: "number" },
									b: { type: "number" }
								},
								required: ["a", "b"]
							}
						},
						{
							name: "calculate",
							description: "Perform basic arithmetic operations",
							inputSchema: {
								type: "object",
								properties: {
									operation: { 
										type: "string", 
										enum: ["add", "subtract", "multiply", "divide"] 
									},
									a: { type: "number" },
									b: { type: "number" }
								},
								required: ["operation", "a", "b"]
							}
						}
					]
				}
			};
			
			sseResponse.write(`data: ${JSON.stringify(result)}\n\n`);
			res.json({ status: "tools list sent via SSE" });
			
		} else if (method === "tools/call") {
			const { name, arguments: args } = params;
			let result;
			
			if (name === "add") {
				const sum = args.a + args.b;
				result = {
					type: "response",
					id: `req_${Date.now()}`,
					result: {
						content: [{ type: "text", text: String(sum) }]
					}
				};
			} else if (name === "calculate") {
				const { operation, a, b } = args;
				let calcResult: number | undefined;
				
				switch (operation) {
					case "add":
						calcResult = a + b;
						break;
					case "subtract":
						calcResult = a - b;
						break;
					case "multiply":
						calcResult = a * b;
						break;
					case "divide":
						if (b === 0) {
							result = {
								type: "response",
								id: `req_${Date.now()}`,
								result: {
									content: [{ type: "text", text: "Error: Cannot divide by zero" }]
								}
							};
							break;
						}
						calcResult = a / b;
						break;
					default:
						result = {
							type: "error",
							id: `req_${Date.now()}`,
							error: { message: "Unknown operation" }
						};
						break;
				}
				
				if (!result && calcResult !== undefined) {
					result = {
						type: "response",
						id: `req_${Date.now()}`,
						result: {
							content: [{ type: "text", text: String(calcResult) }]
						}
					};
				}
			} else {
				result = {
					type: "error",
					id: `req_${Date.now()}`,
					error: { message: "Unknown tool" }
				};
			}
			
			sseResponse.write(`data: ${JSON.stringify(result)}\n\n`);
			res.json({ status: "tool call result sent via SSE" });
			
		} else {
			const errorResult = {
				type: "error",
				id: `req_${Date.now()}`,
				error: { message: "Unknown method" }
			};
			
			sseResponse.write(`data: ${JSON.stringify(errorResult)}\n\n`);
			res.json({ status: "error sent via SSE" });
		}
		
	} catch (error) {
		console.error("SSE message error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
}

// Helper function to get connection status (useful for debugging)
export function getConnectionStatus() {
	return {
		activeConnections: activeConnections.size,
		connectionIds: Array.from(activeConnections.keys())
	};
} 