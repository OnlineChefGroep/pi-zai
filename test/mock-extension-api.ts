import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type {
	EventBus,
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { ZaiModel } from "../src/zai-model.ts";

type Handler = (
	event: unknown,
	ctx: ExtensionContext,
) => Promise<unknown> | unknown;

export type RegisteredCommand = {
	name: string;
	description?: string;
};

export type MockExtensionApi = ExtensionAPI & {
	trigger(
		event: string,
		eventData: unknown,
		ctx: ExtensionContext,
	): Promise<unknown[]>;
	providerCalls: {
		register: Array<[string, unknown]>;
		unregister: string[];
	};
	commandCalls: RegisteredCommand[];
};

export function createZaiModel(): ZaiModel {
	return {
		id: "glm-5.2",
		name: "GLM 5.2",
		provider: "zai",
		api: "openai-completions",
		baseUrl: "https://api.z.ai/api/coding/paas/v4",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 16384,
	};
}

export function createExtensionContext(
	cwd: string,
	model = createZaiModel(),
): ExtensionContext {
	return {
		ui: {
			notify: () => {},
			select: async () => undefined,
			confirm: async () => false,
			input: async () => undefined,
			onTerminalInput: () => () => {},
			setStatus: () => {},
			setWorkingMessage: () => {},
			setWorkingVisible: () => {},
			setWorkingIndicator: () => {},
			setHiddenThinkingLabel: () => {},
			setWidget: () => {},
			setFooter: () => {},
			setHeader: () => {},
			setTitle: () => {},
			custom: async () => undefined as never,
			pasteToEditor: () => {},
			setEditorText: () => {},
			getEditorText: () => "",
			editor: async () => undefined,
			addAutocompleteProvider: () => {},
		},
		mode: "print",
		hasUI: false,
		cwd,
		sessionManager: {
			getSessionId: () => "test-session-id",
			getBranch: () => [],
		} as ExtensionContext["sessionManager"],
		modelRegistry: {
			getApiKey: () => undefined,
			getProviderAuthStatus: () => ({ configured: false }),
		} as ExtensionContext["modelRegistry"],
		model,
		isIdle: () => true,
		isProjectTrusted: () => true,
		signal: undefined,
		abort: () => {},
		hasPendingMessages: () => false,
		shutdown: () => {},
		getContextUsage: () => undefined,
		compact: () => {},
		getSystemPrompt: () => "",
	};
}

export function createMockExtensionApi(options: {
	cwd: string;
	model?: ZaiModel;
}): MockExtensionApi {
	const handlers = new Map<string, Handler[]>();
	const providerCalls = {
		register: [] as Array<[string, unknown]>,
		unregister: [] as string[],
	};
	const commandCalls: RegisteredCommand[] = [];

	const events = {
		on: () => () => {},
		emit: () => {},
	} as unknown as EventBus;

	const pi = {
		on(event: string, handler: Handler) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
		},
		async trigger(
			event: string,
			eventData: unknown,
			context: ExtensionContext,
		) {
			const results: unknown[] = [];
			for (const handler of handlers.get(event) ?? []) {
				results.push(await handler(eventData, context));
			}
			return results;
		},
		registerProvider(name: string, config: unknown) {
			providerCalls.register.push([name, config]);
		},
		unregisterProvider(name: string) {
			providerCalls.unregister.push(name);
		},
		registerCommand(name: string, options: { description?: string }) {
			commandCalls.push({ name, description: options.description });
		},
		registerTool() {},
		registerShortcut() {},
		registerFlag() {},
		getFlag: () => undefined,
		registerMessageRenderer() {},
		registerEntryRenderer() {},
		sendMessage() {},
		sendUserMessage() {},
		appendEntry() {},
		setSessionName() {},
		getSessionName: () => undefined,
		setLabel() {},
		exec: async () => ({ code: 0, stdout: "", stderr: "", killed: false }),
		getActiveTools: () => [] as string[],
		getAllTools: () => [],
		setActiveTools() {},
		getCommands: () => [],
		setModel: async () => true,
		getThinkingLevel: () => "off" as ThinkingLevel,
		setThinkingLevel() {},
		events,
	};

	return Object.assign(pi, {
		providerCalls,
		commandCalls,
		trigger: pi.trigger.bind(pi),
	}) as unknown as MockExtensionApi;
}

export const assistantUsage = {
	input: 10,
	output: 5,
	cacheRead: 90,
	cacheWrite: 0,
	cost: { total: 0 },
};

export async function runExtensionLifecycle(
	pi: MockExtensionApi,
	ctx: ExtensionContext,
	options: { safePromptMode?: boolean } = {},
): Promise<void> {
	// In-process only: triggers each pi.on() handler from index.ts once.
	// No Pi runtime, no provider calls, no LLM tokens.
	const model = ctx.model ?? createZaiModel();
	const systemPrompt = options.safePromptMode
		? "rules\n\n--- dynamic context ---\nctx"
		: "stable system prompt";

	await pi.trigger(
		"session_start",
		{ type: "session_start", reason: "startup" },
		ctx,
	);
	await pi.trigger("model_select", { type: "model_select", model }, ctx);
	await pi.trigger(
		"before_agent_start",
		{ type: "before_agent_start", systemPrompt },
		ctx,
	);
	await pi.trigger(
		"message_start",
		{ type: "message_start", message: { role: "assistant" } },
		ctx,
	);
	await pi.trigger(
		"message_update",
		{ type: "message_update", message: { role: "assistant" } },
		ctx,
	);
	await pi.trigger(
		"message_end",
		{
			type: "message_end",
			message: { role: "assistant", usage: assistantUsage },
		},
		ctx,
	);
	await pi.trigger(
		"turn_end",
		{
			type: "turn_end",
			message: { role: "assistant", usage: assistantUsage },
		},
		ctx,
	);
	await pi.trigger(
		"before_provider_request",
		{
			type: "before_provider_request",
			payload: { thinking: { type: "enabled", clear_thinking: true } },
		},
		ctx,
	);
	await pi.trigger(
		"after_provider_response",
		{ type: "after_provider_response", status: 200 },
		ctx,
	);
	await pi.trigger(
		"before_provider_headers",
		{ type: "before_provider_headers", headers: {} },
		ctx,
	);
	await pi.trigger("session_compact", { type: "session_compact" }, ctx);
	await pi.trigger(
		"session_before_compact",
		{
			type: "session_before_compact",
			compactionInstructions: [],
			customInstructions: undefined,
		},
		ctx,
	);
	await pi.trigger("session_before_tree", { type: "session_before_tree" }, ctx);
	await pi.trigger("agent_settled", { type: "agent_settled" }, ctx);
	await pi.trigger(
		"tool_execution_start",
		{
			type: "tool_execution_start",
			toolCallId: "tool-1",
			toolName: "read",
			args: {},
		},
		ctx,
	);
	await pi.trigger(
		"tool_execution_end",
		{
			type: "tool_execution_end",
			toolCallId: "tool-1",
			toolName: "read",
			result: {},
			isError: false,
		},
		ctx,
	);
	await pi.trigger("session_shutdown", { type: "session_shutdown" }, ctx);
}
