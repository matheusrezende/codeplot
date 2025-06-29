export interface MCPAuth {
  type: 'env' | 'static' | 'oauth';
  variable?: string; // For 'env' type
  value?: string; // For 'static' type
  tokenUrl?: string; // For 'oauth' type
  clientId?: string; // For 'oauth' type
  clientSecret?: string; // For 'oauth' type
}

export interface MCPServerConfig {
  id: string;
  description: string;
  baseUrl: string;
  auth: MCPAuth;
  enabled?: boolean;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}

// MCP Protocol Response Types
export interface MCPSearchResponse {
  results: MCPSearchResult[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

export interface MCPSearchResult {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface MCPContentResponse {
  id: string;
  content: string;
  title?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  lastModified?: string;
}

export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: MCPError;
}

// Tool-related types
export interface MCPToolConfig {
  serverId: string;
  serverConfig: MCPServerConfig;
  toolName: string;
  description: string;
}
