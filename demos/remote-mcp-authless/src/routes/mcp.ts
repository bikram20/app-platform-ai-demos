import { Request, Response } from "express";
import { CalculatorMCPServer } from "../mcp-server.js";

const mcpServer = new CalculatorMCPServer();

export async function handleMCP(req: Request, res: Response) {
	try {
		// Handle MCP protocol requests
		// This is a simplified handler - in practice, you'd need to implement
		// the full MCP protocol handling here
		
		const { method, params } = req.body;
		
		if (method === "tools/list") {
			// Return available tools
			res.json({
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
			});
		} else if (method === "tools/call") {
			// Call a tool
			const { name, arguments: args } = params;
			
			// This is a basic implementation - the MCP SDK would normally handle this
			if (name === "add") {
				const result = args.a + args.b;
				res.json({
					content: [{ type: "text", text: String(result) }]
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
								content: [{ type: "text", text: "Error: Cannot divide by zero" }]
							});
							return;
						}
						result = a / b;
						break;
					default:
						res.status(400).json({ error: "Unknown operation" });
						return;
				}
				
				res.json({
					content: [{ type: "text", text: String(result) }]
				});
			} else {
				res.status(400).json({ error: "Unknown tool" });
			}
		} else {
			res.status(400).json({ error: "Unknown method" });
		}
	} catch (error) {
		console.error("MCP error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
} 