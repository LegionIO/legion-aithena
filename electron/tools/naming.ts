import type { ToolDefinition, ToolSource } from './types.js';

export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function sanitizeToolSegment(value: string, fallback = 'tool'): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');

  return normalized || fallback;
}

export function isValidToolName(name: string): boolean {
  return TOOL_NAME_PATTERN.test(name);
}

export function makeSafeToolName(name: string, fallback = 'tool'): string {
  if (isValidToolName(name)) return name;
  return sanitizeToolSegment(name, fallback);
}

export function buildScopedToolName(
  source: Extract<ToolSource, 'mcp' | 'skill' | 'plugin'>,
  scope: string,
  rawName?: string,
): string {
  if (source === 'skill') return getScopedToolPrefix(source, scope);

  return [
    getScopedToolPrefix(source, scope).replace(/__$/, ''),
    sanitizeToolSegment(rawName ?? 'tool', 'tool'),
  ].join('__');
}

export function getScopedToolPrefix(
  source: Extract<ToolSource, 'mcp' | 'skill' | 'plugin'>,
  scope: string,
): string {
  if (source === 'skill') {
    return `${source}__${sanitizeToolSegment(scope, 'skill')}`;
  }

  return `${source}__${sanitizeToolSegment(scope, source)}__`;
}

export function findToolByName(tools: ToolDefinition[], toolName: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.name === toolName || tool.aliases?.includes(toolName));
}

export function ensureSafeToolDefinition(tool: ToolDefinition): ToolDefinition {
  const safeName = makeSafeToolName(tool.name, tool.source ?? 'tool');
  if (safeName === tool.name) return tool;

  return {
    ...tool,
    name: safeName,
    originalName: tool.originalName ?? tool.name,
    aliases: Array.from(new Set([...(tool.aliases ?? []), tool.name])),
  };
}

export function ensureSafeToolDefinitions(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.map((tool) => ensureSafeToolDefinition(tool));
}
