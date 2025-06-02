import { Request, Response } from "express";
import { CalculatorMCPServer } from "../mcp-server.js";

const mcpServer = new CalculatorMCPServer();

export async function handleMCP(req: Request, res: Response) {
	try {
		const { method, params, id, jsonrpc } = req.body;
		
		console.error(`[MCP] Received method: ${method}`);
		
		// Handle different MCP methods
		switch (method) {
			case "initialize":
				res.json({
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: "2024-11-05",
						capabilities: {
							tools: {}
						},
						serverInfo: {
							name: "calculator-server",
							version: "1.0.0"
						}
					}
				});
				break;
				
			case "initialized":
				// Client confirms initialization
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
		console.error("MCP error:", error);
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