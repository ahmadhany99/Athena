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
  const html = await getAppsSdkCompatibleHtml(baseURL, "/");

  const contentWidget: ContentWidget = {
    id: "get_metro_health",
    title: "Get Montreal Metro Health",
    templateUri: "ui://widget/metro-map",
    invoking: "Checking STM network status...",
    invoked: "Metro status retrieved",
    description:
      "Fetch the real-time service status for the Green, Orange, Yellow, and Blue lines of the STM (Montreal Metro).",
    widgetDomain: baseURL,
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
          text: `<html>${html}</html>`,
          _meta: {
            "openai/widgetDescription": contentWidget.description,
            "openai/widgetPrefersBorder": false,
            "openai/widgetDomain": contentWidget.widgetDomain,
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
