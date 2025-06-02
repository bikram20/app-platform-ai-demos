import { Request, Response } from "express";
import { CalculatorMCPServer } from "../mcp-server.js";

const mcpServer = new CalculatorMCPServer();

// Store active SSE connections
interface SSEConnection {
	id: string;
	res: Response;
	sendMessage: (message: any) => void;
}

const connections = new Map<string, SSEConnection>();
let connectionIdCounter = 0;

// Handle both GET (SSE) and POST (HTTP) requests
export async function handleSSE(req: Request, res: Response) {
	// Handle POST requests (HTTP transport)
	if (req.method === 'POST') {
		return handleHTTPRequest(req, res);
	}
	
	// Handle GET requests (SSE transport)
	const connectionId = `conn_${++connectionIdCounter}`;
	console.error(`[SSE] New connection: ${connectionId}`);
	
	// Set SSE headers
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Access-Control-Allow-Origin": "*",
		"X-Accel-Buffering": "no", // Disable nginx buffering
	});

	// Helper to send SSE messages
	const sendMessage = (message: any) => {
		const data = JSON.stringify(message);
		res.write(`data: ${data}\n\n`);
	};

	// Store connection
	const connection: SSEConnection = {
		id: connectionId,
		res,
		sendMessage
	};
	connections.set(connectionId, connection);

	// Keep-alive ping
	const pingInterval = setInterval(() => {
		if (connections.has(connectionId)) {
			res.write(`:ping\n\n`); // SSE comment for keep-alive
		}
	}, 30000);

	// Handle disconnection
	req.on("close", () => {
		console.error(`[SSE] Connection closed: ${connectionId}`);
		clearInterval(pingInterval);
		connections.delete(connectionId);
	});
}

// Handle HTTP POST requests (for http-first strategy)
async function handleHTTPRequest(req: Request, res: Response) {
	try {
		const { method, params, id, jsonrpc } = req.body;
		console.error(`[HTTP] Received method: ${method}`);
		
		switch (method) {
			case "initialize":
				res.json({
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: "2024-11-05",
						capabilities: {
							tools: {},
							logging: {}
						},
						serverInfo: {
							name: "calculator-server",
							version: "1.0.0"
						}
					}
				});
				break;
				
			case "initialized":
				res.json({
					jsonrpc: "2.0",
					id,
					result: {}
				});
				break;
				
			case "tools/list":
				res.json({
					jsonrpc: "2.0",
					id,
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
				});
				break;
				
			case "tools/call":
				const { name, arguments: args } = params;
				
				if (name === "add") {
					const result = args.a + args.b;
					res.json({
						jsonrpc: "2.0",
						id,
						result: {
							content: [{ type: "text", text: String(result) }]
						}
					});
				} else if (name === "calculate") {
					const { operation, a, b } = args;
					let result: number;
					
					switch (operation) {
						case "add":
							result = a + b;
							break;
						case "subtract":
							result = a - b;
							break;
						case "multiply":
							result = a * b;
							break;
						case "divide":
							if (b === 0) {
								res.json({
									jsonrpc: "2.0",
									id,
									result: {
										content: [{ type: "text", text: "Error: Cannot divide by zero" }]
									}
								});
								return;
							}
							result = a / b;
							break;
						default:
							res.json({
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "Unknown operation"
								}
							});
							return;
					}
					
					res.json({
						jsonrpc: "2.0",
						id,
						result: {
							content: [{ type: "text", text: String(result) }]
						}
					});
				} else {
					res.json({
						jsonrpc: "2.0",
						id,
						error: {
							code: -32602,
							message: "Unknown tool"
						}
					});
				}
				break;
				
			default:
				res.json({
					jsonrpc: "2.0",
					id,
					error: {
						code: -32601,
						message: "Unknown method"
					}
				});
		}
	} catch (error) {
		console.error("HTTP error:", error);
		res.status(500).json({
			jsonrpc: "2.0",
			id: req.body.id || null,
			error: {
				code: -32603,
				message: "Internal server error"
			}
		});
	}
}

export async function handleSSEMessage(req: Request, res: Response) {
	try {
		const { connectionId, ...message } = req.body;
		console.error(`[SSE Message] From ${connectionId}:`, JSON.stringify(message));
		
		// Find the connection
		const targetId = connectionId || Array.from(connections.keys()).pop();
		const connection = connections.get(targetId!);
		
		if (!connection) {
			return res.status(400).json({ 
				error: "No active SSE connection found" 
			});
		}

		// Handle MCP protocol messages
		const { method, params, id, jsonrpc } = message;
		
		switch (method) {
			case "initialize":
				connection.sendMessage({
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: "2024-11-05",
						capabilities: {
							tools: {},
							logging: {}
						},
						serverInfo: {
							name: "calculator-server",
							version: "1.0.0"
						}
					}
				});
				break;
				
			case "initialized":
				connection.sendMessage({
					jsonrpc: "2.0",
					id,
					result: {}
				});
				break;
				
			case "tools/list":
				connection.sendMessage({
					jsonrpc: "2.0",
					id,
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
				});
				break;
				
			case "tools/call":
				const { name, arguments: args } = params;
				
				if (name === "add") {
					const result = args.a + args.b;
					connection.sendMessage({
						jsonrpc: "2.0",
						id,
						result: {
							content: [{ type: "text", text: String(result) }]
						}
					});
				} else if (name === "calculate") {
					const { operation, a, b } = args;
					let result: number;
					
					switch (operation) {
						case "add":
							result = a + b;
							break;
						case "subtract":
							result = a - b;
							break;
						case "multiply":
							result = a * b;
							break;
						case "divide":
							if (b === 0) {
								connection.sendMessage({
									jsonrpc: "2.0",
									id,
									result: {
										content: [{ type: "text", text: "Error: Cannot divide by zero" }]
									}
								});
								res.json({ status: "sent" });
								return;
							}
							result = a / b;
							break;
						default:
							connection.sendMessage({
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "Unknown operation"
								}
							});
							res.json({ status: "sent" });
							return;
					}
					
					connection.sendMessage({
						jsonrpc: "2.0",
						id,
						result: {
							content: [{ type: "text", text: String(result) }]
						}
					});
				} else {
					connection.sendMessage({
						jsonrpc: "2.0",
						id,
						error: {
							code: -32602,
							message: "Unknown tool"
						}
					});
				}
				break;
				
			default:
				connection.sendMessage({
					jsonrpc: "2.0",
					id,
					error: {
						code: -32601,
						message: "Unknown method"
					}
				});
		}
		
		res.json({ status: "message sent" });
		
	} catch (error) {
		console.error("SSE message error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
}