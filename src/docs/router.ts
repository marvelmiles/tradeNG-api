import { Router, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { v1Spec } from "@/docs/v1.spec";

const docsRouter = Router();

const versions: { label: string; slug: string; current: boolean; description: string }[] = [
  { label: "v1", slug: "v1", current: true, description: "Current stable release" },
];

const homepageHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TradeNG API Documentation</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }

    :root {
      --bg:      #ffffff;
      --panel:   #f6f8fa;
      --border:  #d8dee4;
      --text:    #1b1f24;
      --muted:   #57606a;
      --accent:  #0969da;
      --accent-hover: #0550ae;
      --mono:    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    .wrap {
      max-width: 760px;
      margin: 0 auto;
      padding: 3rem 1.5rem 4rem;
    }

    header {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }

    header .mark {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1.1rem;
      flex-shrink: 0;
    }

    header h1 {
      font-size: 1.15rem;
      font-weight: 600;
    }

    header .tag {
      font-size: .8rem;
      color: var(--muted);
    }

    h2 {
      font-size: .95rem;
      font-weight: 600;
      margin: 2rem 0 .75rem;
    }

    p.lede {
      color: var(--muted);
      font-size: .95rem;
      max-width: 60ch;
    }

    table.meta {
      width: 100%;
      border-collapse: collapse;
      font-size: .88rem;
      margin-top: .5rem;
    }

    table.meta td {
      padding: .5rem .75rem;
      border-bottom: 1px solid var(--border);
    }

    table.meta td:first-child {
      color: var(--muted);
      width: 160px;
    }

    table.meta code {
      font-family: var(--mono);
      font-size: .85em;
      background: var(--panel);
      padding: .1rem .35rem;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .version-list {
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      margin-top: .5rem;
    }

    .version-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .85rem 1rem;
      background: var(--bg);
    }

    .version-row + .version-row {
      border-top: 1px solid var(--border);
    }

    .version-row .label {
      font-weight: 600;
      font-size: .92rem;
    }

    .version-row .desc {
      color: var(--muted);
      font-size: .82rem;
      margin-top: 2px;
    }

    .version-row .actions {
      display: flex;
      gap: 1.25rem;
      flex-shrink: 0;
    }

    .version-row a {
      color: var(--accent);
      text-decoration: none;
      font-size: .85rem;
      font-weight: 500;
    }

    .version-row a:hover {
      color: var(--accent-hover);
      text-decoration: underline;
    }

    .badge {
      display: inline-block;
      font-size: .68rem;
      font-weight: 600;
      color: var(--accent);
      background: rgba(9,105,218,.1);
      border: 1px solid rgba(9,105,218,.25);
      padding: .1rem .45rem;
      border-radius: 99px;
      margin-left: .5rem;
      vertical-align: middle;
    }

    footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: .8rem;
      color: var(--muted);
    }

    footer a {
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="mark">T</div>
      <div>
        <h1>TradeNG API</h1>
        <div class="tag">Reference documentation</div>
      </div>
    </header>

    <p class="lede">
      TradeNG is a peer-to-peer escrow marketplace API. Payments are held in escrow until the
      buyer confirms receipt, protecting both parties in every transaction.
    </p>

    <h2>API reference</h2>
    <table class="meta">
      <tr><td>Auth</td><td>JWT Bearer token</td></tr>
      <tr><td>Format</td><td>JSON over REST</td></tr>
      <tr><td>Base URL</td><td><code>/api/v1</code></td></tr>
    </table>

    <h2>Versions</h2>
    <div class="version-list">
      ${versions
        .map(
          (v) => `<div class="version-row">
        <div>
          <span class="label">${v.label}</span>${v.current ? '<span class="badge">Current</span>' : ""}
          <div class="desc">${v.description}</div>
        </div>
        <div class="actions">
          <a href="/api/docs/${v.slug}">Browse docs</a>
          <a href="/api/docs/${v.slug}/spec.json">OpenAPI JSON</a>
        </div>
      </div>`
        )
        .join("")}
    </div>

    <h2>Status</h2>
    <table class="meta">
      <tr><td>Health check</td><td><a href="/api/health">/api/health</a></td></tr>
    </table>

    <footer>
      TradeNG &copy; ${new Date().getFullYear()} &middot; All rights reserved
    </footer>
  </div>
</body>
</html>`;

docsRouter.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(homepageHtml());
});

docsRouter.get("/v1/spec.json", (_req: Request, res: Response) => {
  res.json(v1Spec);
});

const swaggerOptions = {
  swaggerOptions: {
    url: "/api/docs/v1/spec.json",
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 2,
  },
  customCss: `
    .swagger-ui .topbar { background: #ffffff; border-bottom: 1px solid #d8dee4; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .topbar-wrapper .link span { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: "TradeNG API v1"; color: #1b1f24; font-size: 1rem; font-weight: 700; }
    .swagger-ui .info .title { color: #0969da; }
  `,
  customSiteTitle: "TradeNG API v1 – Docs",
};

docsRouter.use(
  "/v1",
  swaggerUi.serveFiles(v1Spec as Parameters<typeof swaggerUi.serveFiles>[0], swaggerOptions),
  swaggerUi.setup(v1Spec as Parameters<typeof swaggerUi.setup>[0], swaggerOptions)
);

export default docsRouter;
