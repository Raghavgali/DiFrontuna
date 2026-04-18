// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HIGH_RISK_KEYWORDS = [
  "chest pain",
  "not breathing",
  "unconscious",
  "fire",
  "burning",
  "gas leak",
  "assault",
  "stabbed",
  "shot",
  "bleeding heavily",
  "collapsed",
  "no respira",
  "fuego",
  "incendio",
  "无法呼吸",
  "火灾",
  "起火",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lower = transcript.toLowerCase();
    const forceEmergency = HIGH_RISK_KEYWORDS.some((k) => lower.includes(k));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are DiFrontuna, the AI voice agent for a city's NON-EMERGENCY 311 line.
Your job is to triage incoming civic-service calls and ESCALATE to 911 when a real emergency is reported.

CLASSIFICATION RULES:
- "emergency": A life-threatening situation reported on the non-emergency line — caller has reached us by mistake or doesn't know which number to call. Examples: medical crisis, active fire, assault, gas leak, unconscious person. MUST be immediately escalated to 911.
- "urgent": Serious civic issue needing same-day response (water main break flooding street, downed power line not on fire, witnessed property crime).
- "standard": Routine civic complaints (noise, sanitation, potholes, abandoned vehicles, building permits).

LANGUAGE: detect from transcript — exactly one of: english, spanish, mandarin.

ROUTING:
- Emergency → "🚨 ESCALATE — 911 EMS Dispatch" / "911 Fire Department" / "911 Police Dispatch"
- Urgent civic → "DPW — Emergency Maintenance" or appropriate dept
- Standard civic → "311 — Sanitation" / "311 — Noise & Nuisance" / "311 — General City Services" / etc.

CATEGORY for emergencies: "Medical (Escalated)", "Fire (Escalated)", or "Crime (Escalated)".
${forceEmergency ? "\n⚠️ HIGH-RISK KEYWORDS DETECTED. Severity MUST be 'emergency' and routing MUST escalate to 911." : ""}

Generate a realistic caller name if not given. Provide a 1-sentence English summary.
For emergencies, the description should note "Caller reached 311 instead of 911 — auto-escalated."`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_ticket",
          description: "Create a structured triage ticket from the call transcript.",
          parameters: {
            type: "object",
            properties: {
              caller_name: { type: "string" },
              caller_phone: { type: "string" },
              location: { type: "string" },
              severity: {
                type: "string",
                enum: ["emergency", "urgent", "standard"],
              },
              language: {
                type: "string",
                enum: ["english", "spanish", "mandarin"],
              },
              category: { type: "string" },
              summary: { type: "string" },
              routing: { type: "string" },
              description: { type: "string" },
            },
            required: [
              "caller_name",
              "location",
              "severity",
              "language",
              "category",
              "summary",
              "routing",
              "description",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Caller transcript (received on 311 line):\n${transcript}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "create_ticket" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned by AI");

    const extracted = JSON.parse(toolCall.function.arguments);

    if (forceEmergency) {
      extracted.severity = "emergency";
      if (!extracted.routing.includes("911")) {
        extracted.routing = "🚨 ESCALATE — 911 EMS Dispatch";
      }
    }

    return new Response(
      JSON.stringify({ ...extracted, transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("triage-call error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
