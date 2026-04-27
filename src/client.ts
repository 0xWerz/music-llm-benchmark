type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callChatCompletion(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(args.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
      max_tokens: args.maxTokens ?? 4000,
      thinking: { type: "disabled" },
      reasoning: { enabled: false },
      chat_template_kwargs: { thinking: false }
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${text.slice(0, 1200)}`);
  }

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
  if (!content) {
    throw new Error(`No completion content: ${text.slice(0, 1200)}`);
  }
  return content;
}
