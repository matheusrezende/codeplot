import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { logger } from '../utils/logger.js';
import type {
  MCPServerConfig,
  MCPSearchResponse,
  MCPContentResponse,
  MCPResponse,
  MCPError,
} from '../types/mcp.js';

declare const fetch: (url: string | URL, init?: RequestInit) => Promise<Response>;

@injectable()
export class MCPClient {
  private config: MCPServerConfig;
  private authToken: string | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async search(
    query: string,
    options?: {
      limit?: number;
      cursor?: string;
      type?: string;
    }
  ): Promise<MCPResponse<MCPSearchResponse>> {
    try {
      logger.debug('MCPClient: Performing search', {
        serverId: this.config.id,
        query: query.substring(0, 100),
        options,
      });

      const token = await this.getAuthToken();
      if (!token) {
        return this.createErrorResponse('AUTH_FAILED', 'Failed to obtain authentication token');
      }

      const searchParams = new URLSearchParams({ query });
      if (options?.limit) searchParams.append('limit', options.limit.toString());
      if (options?.cursor) searchParams.append('cursor', options.cursor);
      if (options?.type) searchParams.append('type', options.type);

      const url = `${this.config.baseUrl}/search?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Codeplot-CLI/1.0.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MCPClient: Search request failed', {
          serverId: this.config.id,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return this.createErrorResponse(
          'HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status, body: errorText }
        );
      }

      const data = (await response.json()) as MCPSearchResponse;

      logger.info('MCPClient: Search completed successfully', {
        serverId: this.config.id,
        resultCount: data.results?.length || 0,
        hasMore: data.hasMore,
      });

      return { success: true, data };
    } catch (error) {
      logger.error('MCPClient: Search failed with exception', {
        serverId: this.config.id,
        error: (error as Error).message,
      });

      return this.createErrorResponse(
        'NETWORK_ERROR',
        `Network error: ${(error as Error).message}`
      );
    }
  }

  async getContent(
    id: string,
    options?: {
      includeMetadata?: boolean;
    }
  ): Promise<MCPResponse<MCPContentResponse>> {
    try {
      logger.debug('MCPClient: Getting content', {
        serverId: this.config.id,
        contentId: id,
        options,
      });

      const token = await this.getAuthToken();
      if (!token) {
        return this.createErrorResponse('AUTH_FAILED', 'Failed to obtain authentication token');
      }

      const searchParams = new URLSearchParams();
      if (options?.includeMetadata) searchParams.append('metadata', 'true');

      const url = `${this.config.baseUrl}/content/${encodeURIComponent(id)}${
        searchParams.toString() ? `?${searchParams.toString()}` : ''
      }`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Codeplot-CLI/1.0.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MCPClient: Get content request failed', {
          serverId: this.config.id,
          contentId: id,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return this.createErrorResponse(
          'HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status, body: errorText }
        );
      }

      const data = (await response.json()) as MCPContentResponse;

      logger.info('MCPClient: Content retrieved successfully', {
        serverId: this.config.id,
        contentId: id,
        contentLength: data.content?.length || 0,
      });

      return { success: true, data };
    } catch (error) {
      logger.error('MCPClient: Get content failed with exception', {
        serverId: this.config.id,
        contentId: id,
        error: (error as Error).message,
      });

      return this.createErrorResponse(
        'NETWORK_ERROR',
        `Network error: ${(error as Error).message}`
      );
    }
  }

  async listTypes(): Promise<MCPResponse<string[]>> {
    try {
      logger.debug('MCPClient: Listing content types', {
        serverId: this.config.id,
      });

      const token = await this.getAuthToken();
      if (!token) {
        return this.createErrorResponse('AUTH_FAILED', 'Failed to obtain authentication token');
      }

      const url = `${this.config.baseUrl}/types`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Codeplot-CLI/1.0.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MCPClient: List types request failed', {
          serverId: this.config.id,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return this.createErrorResponse(
          'HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status, body: errorText }
        );
      }

      const data = (await response.json()) as { types: string[] };

      logger.info('MCPClient: Content types retrieved successfully', {
        serverId: this.config.id,
        typeCount: data.types?.length || 0,
      });

      return { success: true, data: data.types };
    } catch (error) {
      logger.error('MCPClient: List types failed with exception', {
        serverId: this.config.id,
        error: (error as Error).message,
      });

      return this.createErrorResponse(
        'NETWORK_ERROR',
        `Network error: ${(error as Error).message}`
      );
    }
  }

  private async getAuthToken(): Promise<string | null> {
    if (this.authToken) {
      return this.authToken;
    }

    try {
      switch (this.config.auth.type) {
        case 'env': {
          if (!this.config.auth.variable) {
            logger.error('MCPClient: Environment variable not specified for auth');
            return null;
          }
          const envToken = process.env[this.config.auth.variable];
          if (!envToken) {
            logger.error('MCPClient: Environment variable not found', {
              variable: this.config.auth.variable,
              serverId: this.config.id,
            });
            return null;
          }
          this.authToken = envToken;
          return this.authToken;
        }
        case 'static': {
          if (!this.config.auth.value) {
            logger.error('MCPClient: Static auth value not specified');
            return null;
          }
          this.authToken = this.config.auth.value;
          return this.authToken;
        }
        case 'oauth':
          logger.error('MCPClient: OAuth authentication not yet implemented');
          return null;
        default:
          logger.error('MCPClient: Unknown auth type', {
            authType: this.config.auth.type,
            serverId: this.config.id,
          });
          return null;
      }
    } catch (error) {
      logger.error('MCPClient: Failed to get auth token', {
        serverId: this.config.id,
        error: (error as Error).message,
      });
      return null;
    }
  }

  private createErrorResponse<T>(
    code: string,
    message: string,
    details?: Record<string, any>
  ): MCPResponse<T> {
    const error: MCPError = { code, message, details };
    return { success: false, error };
  }

  async testConnection(): Promise<MCPResponse<{ status: string; serverInfo?: any }>> {
    try {
      logger.debug('MCPClient: Testing connection', {
        serverId: this.config.id,
        baseUrl: this.config.baseUrl,
      });

      const token = await this.getAuthToken();
      if (!token) {
        return this.createErrorResponse('AUTH_FAILED', 'Failed to obtain authentication token');
      }

      const url = `${this.config.baseUrl}/health`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Codeplot-CLI/1.0.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return this.createErrorResponse(
          'CONNECTION_FAILED',
          `Server responded with status ${response.status}`,
          { status: response.status }
        );
      }

      const data = await response.json();

      logger.info('MCPClient: Connection test successful', {
        serverId: this.config.id,
      });

      return {
        success: true,
        data: {
          status: 'connected',
          serverInfo: data,
        },
      };
    } catch (error) {
      logger.error('MCPClient: Connection test failed', {
        serverId: this.config.id,
        error: (error as Error).message,
      });

      return this.createErrorResponse(
        'CONNECTION_FAILED',
        `Connection test failed: ${(error as Error).message}`
      );
    }
  }
}
