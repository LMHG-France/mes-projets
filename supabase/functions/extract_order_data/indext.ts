import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderData {
  supplier_name: string;
  items: Array<{
    name: string;
    quantity: number;
    pricePerUnit: number;
    price_ht?: number;
    price_ttc?: number;
  }>;
  total_price: number;
  tracking_link?: string;
  expected_delivery_date?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Check if API key is configured
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "API key not configured. Please configure ANTHROPIC_API_KEY in Supabase Edge Function secrets."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"];

    if (!validTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert file to base64 safely (avoid stack overflow with large files)
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    // Convert in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Data = btoa(binary);

    let contentBlock: any;

    if (file.type === "application/pdf") {
      contentBlock = {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      };
    } else {
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/png";

      if (file.type === "image/png") {
        mediaType = "image/png";
      } else if (file.type === "image/gif") {
        mediaType = "image/gif";
      } else if (file.type === "image/webp") {
        mediaType = "image/webp";
      } else {
        mediaType = "image/jpeg";
      }

      contentBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      };
    }

    console.log("Calling Anthropic API...");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: "Extract order data from this invoice. Return ONLY valid JSON, no markdown, no code blocks. For French invoices use TTC prices with tax not HT prices without tax. Add shipping fees as a separate item. Use the final Total TTC amount. Format: {\"supplier_name\":\"store\",\"items\":[{\"name\":\"product\",\"quantity\":1,\"pricePerUnit\":10.00}],\"total_price\":10.00,\"tracking_link\":null,\"expected_delivery_date\":null}",
              },
            ],
          },
        ],
      }),
    });

    console.log("API Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      let errorMessage = "Failed to process image";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = errorText.substring(0, 200);
      }

      return new Response(
        JSON.stringify({
          error: "Failed to process image",
          details: errorMessage,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("API Response received, content blocks:", data.content?.length);

    const textContent = data.content.find(
      (block: any) => block.type === "text"
    );
    if (!textContent) {
      return new Response(
        JSON.stringify({ error: "No text response from AI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract JSON from response - handle code blocks
    let jsonText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
    }

    // Find JSON object - use a more precise regex
    const jsonMatch = jsonText.match(/\{[\s\S]*?\}(?=\s*$)/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          error: "Could not parse JSON from response",
          raw: textContent.text.substring(0, 500),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let orderData: OrderData;
    let rawJson = jsonMatch[0];

    try {
      // Clean up potential JSON issues more aggressively
      // First normalize all whitespace characters
      rawJson = rawJson.replace(/[\n\r\t]/g, ' ');
      // Fix multiple spaces
      rawJson = rawJson.replace(/\s+/g, ' ');
      // Remove trailing commas before closing brackets
      rawJson = rawJson.replace(/,(\s*[}\]])/g, '$1');
      // Fix common issues with smart quotes
      rawJson = rawJson.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

      // Try to fix common JSON issues by attempting to parse and catch specific errors
      let parsed = false;
      let attempts = 0;

      while (!parsed && attempts < 3) {
        try {
          orderData = JSON.parse(rawJson);
          parsed = true;
        } catch (e) {
          attempts++;
          if (attempts >= 3) throw e;

          // Try to fix the specific error
          const errorMsg = e instanceof Error ? e.message : '';

          // Look for position information in error message
          const posMatch = errorMsg.match(/position (\d+)/);
          if (posMatch) {
            const pos = parseInt(posMatch[1]);
            // Check if there's an unescaped quote near this position
            const context = rawJson.substring(Math.max(0, pos - 50), Math.min(rawJson.length, pos + 50));
            console.log('Error context:', context);

            // Try to escape quotes in string values
            rawJson = rawJson.replace(/"([^"]*?)"(\s*):/g, (match, key, space) => {
              // This is a property name, keep it
              return match;
            });
          }

          // Last resort: try to extract just the core data
          if (attempts === 2) {
            const supplierMatch = rawJson.match(/"supplier_name"\s*:\s*"([^"]*)"/);
            const totalMatch = rawJson.match(/"total_price"\s*:\s*([\d.]+)/);

            if (supplierMatch && totalMatch) {
              // Build a minimal valid JSON
              rawJson = JSON.stringify({
                supplier_name: supplierMatch[1],
                items: [],
                total_price: parseFloat(totalMatch[1]),
                tracking_link: null,
                expected_delivery_date: null
              });
            }
          }
        }
      }

      if (!parsed) {
        orderData = JSON.parse(rawJson);
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw JSON:", rawJson.substring(0, 1000));

      // Try to extract just the error message if it's a simple error response
      const errorMatch = rawJson.match(/"error"\s*:\s*"([^"]*)"/);
      if (errorMatch) {
        return new Response(
          JSON.stringify({
            error: errorMatch[1],
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Invalid JSON format from AI",
          details: parseError instanceof Error ? parseError.message : "Unknown parse error",
          raw: rawJson.substring(0, 500),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (orderData.error) {
      return new Response(JSON.stringify(orderData), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(orderData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});