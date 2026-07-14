export const LOADER_TOOL_NAME = "zai_load_tools";

export type AdaptiveLoadResult = {
	requested: string[];
	added: string[];
	alreadyActive: string[];
	unknown: string[];
};
