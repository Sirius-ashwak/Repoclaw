/**
 * Offline Mode Manager
 * Handles offline fallback with local Ollama LLM and IndexedDB caching
 * Detects connectivity, switches between Bedrock and Ollama, syncs when online
 */

export interface OfflineConfig {
  ollamaEndpoint: string;
  ollamaModel: string;
  maxCachedResults: number;
  pingUrl: string;
  pingIntervalMs: number;
}

export interface CachedPipeline {
  pipelineId: string;
  sessionId: string;
  result: any; // PipelineState
  artifacts: Array<{
    type: string;
    name: string;
    content: string; // base64 encoded for offline
  }>;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt: number | null;
}

export type ConnectivityMode = 'online' | 'offline';

export type ConnectivityListener = (mode: ConnectivityMode) => void;

const DEFAULT_CONFIG: OfflineConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
  maxCachedResults: 10,
  pingUrl: 'https://bedrock-runtime.ap-south-1.amazonaws.com',
  pingIntervalMs: 5000,
};

/**
 * OllamaClient for local LLM inference
 */
export class OllamaClient {
  private endpoint: string;
  private model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint;
    this.model = model;
  }

  /**
   * Check if Ollama is installed and running
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;

      const data = await response.json();
      const targetModel = modelName || this.model;
      return data.models?.some((m: any) => m.name.startsWith(targetModel)) || false;
    } catch {
      return false;
    }
  }

  /**
   * Generate text using Ollama
   */
  async generate(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: options?.systemPrompt
          ? `System: ${options.systemPrompt}\n\nUser: ${prompt}`
          : prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens || 2048,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${await response.text()}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Get installation instructions
   */
  static getInstallationInstructions(): string {
    return `
## Ollama Installation Instructions

Ollama is required for offline mode. Follow these steps:

### Windows
1. Download from https://ollama.ai/download/windows
2. Run the installer
3. Open a terminal and run: ollama serve

### macOS
1. Download from https://ollama.ai/download/mac
2. Move to Applications folder
3. Open Ollama from Applications

### Linux
curl -fsSL https://ollama.ai/install.sh | sh

### After Installation
Run these commands to download required models:
\`\`\`bash
ollama pull llama3
ollama pull codellama
\`\`\`

Then verify with:
\`\`\`bash
ollama list
\`\`\`
    `.trim();
  }
}

/**
 * IndexedDB Cache for offline pipeline results
 */
export class IndexedDBCache {
  private dbName: string;
  private storeName: string;
  private maxEntries: number;
  private db: IDBDatabase | null = null;

  constructor(maxEntries: number = 10) {
    this.dbName = 'repoclaw-offline';
    this.storeName = 'pipeline-results';
    this.maxEntries = maxEntries;
  }

  /**
   * Open the IndexedDB database
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment'));
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'pipelineId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };
    });
  }

  /**
   * Store a pipeline result
   */
  async put(entry: CachedPipeline): Promise<void> {
    await this._ensureOpen();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(entry);

      tx.oncomplete = () => {
        this._enforceMaxEntries().then(resolve);
      };
      tx.onerror = () => reject(new Error('Failed to store pipeline result'));
    });
  }

  /**
   * Get a cached pipeline result
   */
  async get(pipelineId: string): Promise<CachedPipeline | null> {
    await this._ensureOpen();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(pipelineId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get cached result'));
    });
  }

  /**
   * Get all unsynced results
   */
  async getUnsynced(): Promise<CachedPipeline[]> {
    await this._ensureOpen();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(0));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get unsynced results'));
    });
  }

  /**
   * Mark a result as synced
   */
  async markSynced(pipelineId: string): Promise<void> {
    const entry = await this.get(pipelineId);
    if (entry) {
      entry.synced = true;
      await this.put(entry);
    }
  }

  /**
   * Get all cached results
   */
  async getAll(): Promise<CachedPipeline[]> {
    await this._ensureOpen();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get all cached results'));
    });
  }

  /**
   * Delete a cached result
   */
  async delete(pipelineId: string): Promise<void> {
    await this._ensureOpen();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(pipelineId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Failed to delete cached result'));
    });
  }

  /**
   * Enforce max entries by removing oldest
   */
  private async _enforceMaxEntries(): Promise<void> {
    const all = await this.getAll();
    if (all.length > this.maxEntries) {
      const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = sorted.slice(0, all.length - this.maxEntries);
      for (const entry of toRemove) {
        await this.delete(entry.pipelineId);
      }
    }
  }

  /**
   * Ensure DB is open
   */
  private async _ensureOpen(): Promise<void> {
    if (!this.db) {
      await this.open();
    }
  }
}

/**
 * Main Offline Manager
 */
export class OfflineManager {
  private config: OfflineConfig;
  private ollamaClient: OllamaClient;
  private cache: IndexedDBCache;
  private currentMode: ConnectivityMode = 'online';
  private listeners: ConnectivityListener[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<OfflineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ollamaClient = new OllamaClient(this.config.ollamaEndpoint, this.config.ollamaModel);
    this.cache = new IndexedDBCache(this.config.maxCachedResults);
  }

  /**
   * Start connectivity monitoring
   */
  startMonitoring(): void {
    this._checkConnectivity();
    this.pingInterval = setInterval(() => {
      this._checkConnectivity();
    }, this.config.pingIntervalMs);
  }

  /**
   * Stop connectivity monitoring
   */
  stopMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get current connectivity mode
   */
  getMode(): ConnectivityMode {
    return this.currentMode;
  }

  /**
   * Add listener for connectivity changes
   */
  onModeChange(listener: ConnectivityListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Check if Ollama is installed and ready
   */
  async checkOllamaInstallation(): Promise<{
    installed: boolean;
    hasModel: boolean;
    instructions?: string;
  }> {
    const installed = await this.ollamaClient.isAvailable();
    if (!installed) {
      return {
        installed: false,
        hasModel: false,
        instructions: OllamaClient.getInstallationInstructions(),
      };
    }

    const hasModel = await this.ollamaClient.hasModel();
    return {
      installed: true,
      hasModel,
      instructions: hasModel
        ? undefined
        : `Run: ollama pull ${this.config.ollamaModel}`,
    };
  }

  /**
   * Get the Ollama client for offline inference
   */
  getOllamaClient(): OllamaClient {
    return this.ollamaClient;
  }

  /**
   * Cache a pipeline result for offline access
   */
  async cacheResult(
    pipelineId: string,
    sessionId: string,
    result: any,
    artifacts: Array<{ type: string; name: string; content: string }>
  ): Promise<void> {
    await this.cache.put({
      pipelineId,
      sessionId,
      result,
      artifacts,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0,
      lastSyncAttempt: null,
    });
  }

  /**
   * Get a cached pipeline result
   */
  async getCachedResult(pipelineId: string): Promise<CachedPipeline | null> {
    return this.cache.get(pipelineId);
  }

  /**
   * Sync pending results to AWS when online
   * Returns count of successfully synced results
   */
  async syncPendingResults(
    syncFn: (entry: CachedPipeline) => Promise<boolean>
  ): Promise<number> {
    if (this.currentMode !== 'online') {
      return 0;
    }

    const unsynced = await this.cache.getUnsynced();
    let syncedCount = 0;

    for (const entry of unsynced) {
      try {
        entry.syncAttempts++;
        entry.lastSyncAttempt = Date.now();

        const success = await syncFn(entry);
        if (success) {
          await this.cache.markSynced(entry.pipelineId);
          syncedCount++;
        } else {
          await this.cache.put(entry); // Update attempt count
        }
      } catch {
        await this.cache.put(entry); // Update attempt count
      }
    }

    return syncedCount;
  }

  /**
   * Check connectivity and update mode
   */
  private async _checkConnectivity(): Promise<void> {
    const startTime = Date.now();
    let isOnline = false;

    try {
      // Try pinging AWS endpoint
      const response = await fetch(this.config.pingUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      });
      isOnline = response.ok || response.status === 403; // 403 means AWS is reachable
    } catch {
      // Also check general internet
      try {
        const response = await fetch('https://www.google.com', {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000),
        });
        isOnline = response.ok;
      } catch {
        isOnline = false;
      }
    }

    const newMode: ConnectivityMode = isOnline ? 'online' : 'offline';
    const switchTime = Date.now() - startTime;

    if (newMode !== this.currentMode) {
      this.currentMode = newMode;
      console.log(`[OfflineManager] Switched to ${newMode} mode (${switchTime}ms)`);

      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(newMode);
        } catch {
          // Don't let listener errors break monitoring
        }
      }

      // If coming back online, try to sync
      if (newMode === 'online') {
        // Sync will be triggered by the consumer
      }
    }
  }
}
