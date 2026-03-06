import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import * as cheerio from "cheerio";
import { z } from "zod";
import { getSTMStatus } from "@/app/lib/stm";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  description: string;
  widgetDomain?: string;
};

// @ts-ignore
function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as any;
}

const handler = createMcpHandler(async (server: any) => {
  const contentWidget: ContentWidget = {
    id: "get_metro_health",
    title: "Get Montreal Metro Health",
    templateUri: "ui://widget/metro-map.html",
    invoking: "Checking STM network status...",
    invoked: "Metro status retrieved",
    description:
      "Fetch the real-time service status for the Green, Orange, Yellow, and Blue lines of the STM (Montreal Metro).",
  };

  server.registerResource(
    "content-widget",
    contentWidget.templateUri,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": contentWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri: any) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: transparent; color: white; }
              .container { display: flex; flex-direction: row; gap: 40px; background: rgba(15, 23, 42, 0.9); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }
              .map-container { display: flex; position: relative; width: 400px; height: 300px; background: rgba(255,255,255,0.05); border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; justify-content: center; align-items: center; }
              .map-container img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2)); }
              .status-list { display: flex; flex-direction: column; gap: 15px; justify-content: center; width: 250px; }
              .line-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); }
              .line-name { display: flex; align-items: center; gap: 10px; font-weight: bold; }
              .dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
              .badge { font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
              
              /* Dynamic States */
              .status-normal .badge { background: rgba(16, 185, 129, 0.2); color: #34d399; }
              .status-delay { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }
              .status-delay .badge { background: #ef4444; color: white; box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); }
              
              /* Animations */
              @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
              .pulsing-dot::after { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 50%; background: inherit; animation: pulse 2s infinite; }
              @keyframes emergencyMap { 0% { box-shadow: inset 0 0 0px rgba(239, 68, 68, 0); } 50% { box-shadow: inset 0 0 30px rgba(239, 68, 68, 0.5); } 100% { box-shadow: inset 0 0 0px rgba(239, 68, 68, 0); } }
              .emergency-border { position: absolute; inset: 0; border: 4px solid rgba(239, 68, 68, 0.4); border-radius: 15px; animation: emergencyMap 2s infinite; pointer-events: none; display: none; }
            </style>
          </head>
          <body>
            <h1 style="margin-bottom: 20px; font-size: 2rem; background: -webkit-linear-gradient(45deg, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Montreal Metro Pulse</h1>
            
            <div class="container">
              <div class="map-container">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Montreal-metro.svg/800px-Montreal-metro.svg.png" 
                  alt="STM Map"
                  referrerpolicy="no-referrer"
                />
                <div class="emergency-border" id="map-alert"></div>
              </div>

              <div class="status-list">
                <div class="line-item" id="green-line">
                  <div class="line-name"><div class="dot" style="background: #00874e;"></div> Green Line</div>
                  <div class="badge" id="green-badge">Pending</div>
                </div>
                <div class="line-item" id="orange-line">
                  <div class="line-name"><div class="dot" style="background: #ef7d00;"></div> Orange Line</div>
                  <div class="badge" id="orange-badge">Pending</div>
                </div>
                <div class="line-item" id="blue-line">
                  <div class="line-name"><div class="dot" style="background: #0056a3;"></div> Blue Line</div>
                  <div class="badge" id="blue-badge">Pending</div>
                </div>
                <div class="line-item" id="yellow-line">
                  <div class="line-name"><div class="dot" style="background: #ffe400;"></div> Yellow Line</div>
                  <div class="badge" id="yellow-badge">Pending</div>
                </div>
              </div>
            </div>

            <script>
              function updateLine(id, status) {
                const row = document.getElementById(id + '-line');
                const badge = document.getElementById(id + '-badge');
                const isDelay = status === 'delay';
                
                if (isDelay) {
                  row.className = 'line-item status-delay';
                  badge.innerText = 'Disruption';
                } else {
                  row.className = 'line-item status-normal';
                  badge.innerText = 'Normal';
                }
              }

              function updateUI(statuses) {
                if (!statuses) return;
                
                updateLine('green', statuses.green);
                updateLine('orange', statuses.orange);
                updateLine('blue', statuses.blue);
                updateLine('yellow', statuses.yellow);

                const hasAnyDelay = Object.values(statuses).includes('delay');
                document.getElementById('map-alert').style.display = hasAnyDelay ? 'block' : 'none';
              }

              function init() {
                // Read from Athena's injected window payload directly
                if (window.openai && window.openai.toolOutput) {
                   updateUI(window.openai.toolOutput);
                } else {
                   // Fallback for postMessage
                   window.addEventListener('message', (event) => {
                     if (event.data?.structuredContent) {
                       updateUI(event.data.structuredContent);
                     }
                   });
                }
              }

              window.onload = init;
            </script>
          </body>
          </html>
          `,
          _meta: {
            "openai/widgetDescription": contentWidget.description,
            "openai/widgetPrefersBorder": false,
          },
        },
      ],
    }),
  );

  server.registerTool(
    contentWidget.id,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      inputSchema: {
        name: z.string().optional().describe("Ignored parameter for TS bounds"),
      },
      _meta: widgetMeta(contentWidget),
    },
    async ({ name }: { name?: string }) => {
      const statuses = await getSTMStatus();

      return {
        content: [
          {
            type: "text",
            text: `Orange: ${statuses.orange}, Green: ${statuses.green}, Yellow: ${statuses.yellow}, Blue: ${statuses.blue}`,
          },
        ],
        structuredContent: statuses,
        _meta: widgetMeta(contentWidget),
      };
    },
  );
});

export const GET = handler;
export const POST = handler;
