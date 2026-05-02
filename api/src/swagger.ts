import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Predict Intelligence API",
      version: "0.1.0",
      description:
        "REST API serving real-time data from the Predict Intelligence backend. " +
        "Feeds the Perceive / Reason / Act tables in the UI dashboard.",
    },
    servers: [
      { url: `http://localhost:${process.env.PORT ?? 4338}`, description: "Local dev" },
    ],
    components: {
      schemas: {
        MonitoredSource: {
          type: "object",
          required: ["id", "sourceName", "watchFrequency", "lastFetchAt", "lastFetchUri"],
          properties: {
            id: { type: "string", example: "src-polymarket" },
            sourceName: { type: "string", example: "Polymarket Gamma API" },
            watchFrequency: { type: "string", example: "Every 24 hours" },
            lastFetchAt: { type: "string", format: "date-time" },
            lastFetchUri: { type: "string", example: "https://gamma-api.polymarket.com/markets" },
          },
        },
        ReasonRecord: {
          type: "object",
          required: ["id", "decidedAt", "summary", "focusAreas", "promptAlignment"],
          properties: {
            id: { type: "string", example: "rsn-abc123" },
            decidedAt: { type: "string", format: "date-time" },
            summary: { type: "string", example: "Opened long position on BTC market" },
            focusAreas: { type: "array", items: { type: "string" }, example: ["Prediction market"] },
            promptAlignment: { type: "string", example: "2 decision(s) evaluated — 1 action(s) triggered" },
          },
        },
        TriggeredAction: {
          type: "object",
          required: ["id", "kind", "label", "occurredAt"],
          properties: {
            id: { type: "string", example: "trg-d1-1714653600000" },
            kind: {
              type: "string",
              enum: ["swap", "prediction_market", "onchain", "bridge", "other"],
            },
            label: { type: "string", example: "BUY market_id:540816 · $25 USDC" },
            occurredAt: { type: "string", format: "date-time" },
            primaryUrl: { type: "string", nullable: true },
            primaryUrlLabel: { type: "string", nullable: true },
            extraDetail: { type: "string", nullable: true, example: "Dry run" },
          },
        },
        ProfileResponse: {
          type: "object",
          required: ["status", "ensName"],
          properties: {
            status: {
              type: "string",
              enum: ["registered", "pending", "not_found"],
            },
            ensName: { type: "string", example: "alice.agentic.eth" },
            message: { type: "string", nullable: true },
            profile: {
              type: "object",
              nullable: true,
              description: "Full TradingStrategy object — present only when status is registered",
            },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],};

export const swaggerSpec = swaggerJsdoc(options);
