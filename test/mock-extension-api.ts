import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import type { EventBus, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Handler = (event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown;

export type MockExtensionApi = ExtensionAPI & {
	trigger(event: string, eventData: unknown, ctx: ExtensionContext): Promise<void>;
	providerCalls: {
		register: Array<[string, unknown]>;
		unregister: string[];
	};
};

export function createMockExtensionApi(options: {
	cwd: string;
	model?: Model<any>;
}): MockExtensionApi {
	const handlers = new Map<string, Handler[]>();
	const providerCalls = {
		register: [] as Array<[string, unknown]>,
		unregister: [] as string[],
	};

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
		async trigger(event: string, eventData: unknown, context: ExtensionContext) {
			for (const handler of handlers.get(event) ?? []) {
				await handler(eventData, context);
			}
		},
		registerProvider(name: string, config: unknown) {
			providerCalls.register.push([name, config]);
		},
		unregisterProvider(name: string) {
			providerCalls.unregister.push(name);
		},
		registerCommand() {},
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

	return Object.assign(pi, { providerCalls, trigger: pi.trigger.bind(pi) }) as unknown as MockExtensionApi;
}

export function createZaiModel(): Model<any> {
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
