import { 
  Capability, 
  CapabilityCategory, 
  CapabilityStatus, 
  CapabilityRequirement,
  CapabilityMetadata,
  CapabilityHealth,
  CapabilityScanOptions 
} from './types';

export class CapabilityScanner {
  private ctx: any;
  private cache: Map<string, Capability> = new Map();
  private lastScan: Date | null = null;
  private scanPromise: Promise<Capability[]> | null = null;

  constructor(ctx: any) {
    this.ctx = ctx;
  }

  async scanAll(options: CapabilityScanOptions = {}): Promise<Capability[]> {
    if (this.scanPromise && !options.forceRefresh) {
      return this.scanPromise;
    }

    this.scanPromise = this.performScan(options);
    return this.scanPromise;
  }

  async quickScan(): Promise<Capability[]> {
    return this.scanAll({ deep: false });
  }

  async deepScan(): Promise<Capability[]> {
    return this.scanAll({ deep: true });
  }

  async incrementalScan(): Promise<Capability[]> {
    const now = new Date();
    if (this.lastScan && (now.getTime() - this.lastScan.getTime()) < 60000) {
      return Array.from(this.cache.values());
    }
    return this.scanAll({ forceRefresh: true });
  }

  private async performScan(options: CapabilityScanOptions): Promise<Capability[]> {
    const capabilities: Capability[] = [];

    capabilities.push(...await this.scanBuiltinCapabilities());
    capabilities.push(...await this.scanPluginCapabilities());
    capabilities.push(...await this.scanMCPCapabilities());
    capabilities.push(...await this.scanExternalCapabilities());
    capabilities.push(...await this.scanVirtualCapabilities());

    if (options.deep) {
      await this.verifyCapabilities(capabilities);
    }

    this.updateCache(capabilities);
    this.lastScan = new Date();
    this.scanPromise = null;

    return capabilities;
  }

  private async scanBuiltinCapabilities(): Promise<Capability[]> {
    const builtin: Capability[] = [
      {
        name: 'mathcore.verified-compute',
        displayName: 'Verified Mathematical Computation',
        description: 'Zero-hallucination math with independent verification via mathcore MCP',
        category: 'computation',
        subcategory: 'verified-math',
        version: '1.0.0',
        status: 'available',
        priority: 'critical',
        dependencies: ['mathcore-mcp'],
        conflicts: [],
        provides: ['evaluate', 'solve', 'derivative', 'integrate', 'linear-algebra', 'statistics', 'number-theory', 'logic', 'units'],
        requires: [
          { type: 'capability', name: 'mcp.client', optional: false, description: 'MCP client for mathcore communication' },
          { type: 'binary', name: 'mathcore-mcp', optional: false, description: 'mathcore MCP server executable' }
        ],
        metadata: {
          source: 'mcp',
          mcpServer: 'mathcore',
          documentation: 'https://github.com/.../mathcore',
          tags: ['verified', 'offline', 'auditable', 'no-api-key'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'memory.vault',
        displayName: 'Obsidian Vault Memory',
        description: 'Persistent local-first memory with markdown notes, wiki-links, and tags',
        category: 'memory',
        subcategory: 'knowledge-base',
        version: '1.0.0',
        status: 'available',
        priority: 'critical',
        dependencies: ['fs.local'],
        conflicts: [],
        provides: ['create-note', 'search', 'read', 'list-tags', 'wiki-links', 'frontmatter'],
        requires: [
          { type: 'capability', name: 'fs.local', optional: false, description: 'Local filesystem access' },
          { type: 'permission', name: 'vault-read-write', optional: false, description: 'Read/write access to vault directory' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-memory',
          documentation: 'https://obsidian.md',
          tags: ['local-first', 'markdown', 'portable', 'wiki-links'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'agent.loop',
        displayName: 'Agent Loop',
        description: 'Core agent execution loop with turn/step flow, streaming, and cancellation',
        category: 'agents',
        subcategory: 'core',
        version: '1.0.0',
        status: 'available',
        priority: 'critical',
        dependencies: ['llm', 'tools', 'session'],
        conflicts: [],
        provides: ['chat', 'tool-use', 'streaming', 'cancellation', 'multi-turn'],
        requires: [
          { type: 'capability', name: 'llm.provider', optional: false, description: 'LLM provider adapter' },
          { type: 'capability', name: 'tools.registry', optional: false, description: 'Tool registry' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-agent',
          tags: ['core', 'streaming', 'cancellation'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tools.filesystem',
        displayName: 'Filesystem Access',
        description: 'Local/remote/sandboxed filesystem with policy controls',
        category: 'tools',
        subcategory: 'filesystem',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['read', 'write', 'list', 'delete', 'move', 'copy', 'watch', 'policy'],
        requires: [
          { type: 'permission', name: 'fs-read', optional: false, description: 'Filesystem read permission' },
          { type: 'permission', name: 'fs-write', optional: true, description: 'Filesystem write permission' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-fs',
          tags: ['local', 'remote', 'sandboxed', 'policy'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tools.shell',
        displayName: 'Shell Execution',
        description: 'Command execution with subprocess management and PTY support',
        category: 'tools',
        subcategory: 'shell',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['exec', 'background', 'pty', 'env', 'cwd', 'timeout'],
        requires: [
          { type: 'permission', name: 'shell-exec', optional: false, description: 'Shell execution permission' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-shell',
          tags: ['subprocess', 'pty', 'async', 'cross-platform'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tools.browser',
        displayName: 'Browser Automation',
        description: 'Playwright-based browser automation with multiple contexts',
        category: 'tools',
        subcategory: 'browser',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: ['playwright'],
        conflicts: [],
        provides: ['navigate', 'click', 'type', 'extract', 'screenshot', 'pdf', 'network'],
        requires: [
          { type: 'package', name: 'playwright', optional: false, description: 'Playwright library' },
          { type: 'binary', name: 'chromium', optional: true, description: 'Chromium browser' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-browser',
          tags: ['playwright', 'headless', 'stealth', 'multi-context'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tools.terminal',
        displayName: 'Terminal Sessions',
        description: 'Persistent PTY terminal sessions with history',
        category: 'tools',
        subcategory: 'terminal',
        version: '1.0.0',
        status: 'available',
        priority: 'medium',
        dependencies: [],
        conflicts: [],
        provides: ['create', 'write', 'read', 'resize', 'kill', 'list', 'history'],
        requires: [
          { type: 'permission', name: 'pty-access', optional: false, description: 'PTY access permission' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-terminal',
          tags: ['pty', 'persistent', 'cross-platform'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tools.lsp',
        displayName: 'Language Server Protocol',
        description: 'Multi-language code intelligence (TS, Python, Rust, Go, JSON)',
        category: 'tools',
        subcategory: 'lsp',
        version: '1.0.0',
        status: 'available',
        priority: 'medium',
        dependencies: ['language-servers'],
        conflicts: [],
        provides: ['hover', 'definition', 'references', 'diagnostics', 'completion', 'rename'],
        requires: [
          { type: 'binary', name: 'typescript-language-server', optional: true, description: 'TypeScript LSP' },
          { type: 'binary', name: 'pylsp', optional: true, description: 'Python LSP' },
          { type: 'binary', name: 'rust-analyzer', optional: true, description: 'Rust LSP' },
          { type: 'binary', name: 'gopls', optional: true, description: 'Go LSP' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-lsp',
          tags: ['code-intelligence', 'multi-language', 'ide-features'],
          maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'agents.subagent',
        displayName: 'Subagent Delegation',
        description: 'Child agents, delegated turns, and specialist agents',
        category: 'agents',
        subcategory: 'delegation',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: ['agent.loop'],
        conflicts: [],
        provides: ['spawn', 'delegate', 'specialist', 'context-isolation'],
        requires: [
          { type: 'capability', name: 'agent.loop', optional: false, description: 'Core agent loop' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-subagent',
          tags: ['delegation', 'isolation', 'specialist'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'workflows.orchestration',
        displayName: 'Workflow Orchestration',
        description: 'Template-based workflow execution with persistence',
        category: 'workflows',
        subcategory: 'orchestration',
        version: '1.0.0',
        status: 'available',
        priority: 'medium',
        dependencies: ['agent.loop', 'tools'],
        conflicts: [],
        provides: ['templates', 'parallel', 'sequential', 'retry', 'persistence'],
        requires: [
          { type: 'capability', name: 'agent.loop', optional: false, description: 'Core agent loop' },
          { type: 'capability', name: 'storage', optional: true, description: 'Workflow persistence' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-workflow',
          tags: ['templates', 'parallel', 'retry', 'persistence'],
          maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'mcp.client',
        displayName: 'MCP Client',
        description: 'Model Context Protocol client for server communication',
        category: 'communication',
        subcategory: 'mcp',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['stdio', 'sse', 'websocket', 'capability-negotiation'],
        requires: [],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-mcp',
          tags: ['protocol', 'extensible', 'standard'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'computer-use.automation',
        displayName: 'Computer Use Automation',
        description: 'Screen, keyboard, mouse automation via Playwright',
        category: 'perception',
        subcategory: 'automation',
        version: '1.0.0',
        status: 'available',
        priority: 'medium',
        dependencies: ['tools.browser'],
        conflicts: [],
        provides: ['screenshot', 'click', 'type', 'key', 'scroll', 'drag', 'ocr'],
        requires: [
          { type: 'capability', name: 'tools.browser', optional: false, description: 'Browser automation' },
          { type: 'permission', name: 'screen-access', optional: false, description: 'Screen capture permission' }
        ],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-computer-use',
          tags: ['gui', 'automation', 'accessibility'],
          maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'languages.polyglot',
        displayName: 'Programming Languages',
        description: 'Multi-language detection, analysis, formatting, linting, testing, and tooling for 17+ languages',
        category: 'tools',
        subcategory: 'languages',
        version: '0.1.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['language-detect', 'code-analyze', 'code-format', 'code-lint', 'run-tests', 'tooling-guide'],
        requires: [],
        metadata: {
          source: 'builtin',
          pluginId: 'qeek-languages',
          documentation: 'docs/capabilities/languages.md',
          tags: ['polyglot', 'ast', 'format', 'lint', 'test', '17-languages'],
          maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'code.review',
        displayName: 'AI Code Review',
        description: 'Complexity hotspots, duplication, dead code, and secret detection with fix suggestions',
        category: 'tools',
        subcategory: 'code-analysis',
        version: '0.1.0',
        status: 'available',
        priority: 'medium',
        dependencies: [],
        conflicts: [],
        provides: ['code-review', 'hotspots', 'duplication', 'dead-code'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-code-analysis',
          tags: ['review', 'quality'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'docs.generate',
        displayName: 'Documentation Generator',
        description: 'Offline Markdown API docs generated from source exports',
        category: 'tools',
        subcategory: 'docgen',
        version: '0.1.0',
        status: 'available',
        priority: 'low',
        dependencies: [],
        conflicts: [],
        provides: ['docs-generate'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-docgen',
          tags: ['docs', 'offline'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'project.health',
        displayName: 'Project Health Monitor',
        description: 'Scores projects on tests, CI, docs, dependencies, and TODO debt',
        category: 'reasoning',
        subcategory: 'health',
        version: '0.1.0',
        status: 'available',
        priority: 'medium',
        dependencies: [],
        conflicts: [],
        provides: ['project-health', 'health-score'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-health',
          tags: ['health', 'score'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'memory.graph',
        displayName: 'Knowledge Graph',
        description: 'Vault wiki-link graph with orphans, hubs, and DOT export',
        category: 'memory',
        subcategory: 'graph',
        version: '0.1.0',
        status: 'available',
        priority: 'medium',
        dependencies: ['memory.vault'],
        conflicts: [],
        provides: ['vault-graph', 'orphans', 'hubs', 'dot-export'],
        requires: [
          { type: 'capability', name: 'memory.vault', optional: false, description: 'Vault access' }
        ],
        metadata: {
          source: 'builtin', pluginId: 'qeek-graph',
          tags: ['graph', 'wiki-links'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'tasks.smart-schedule',
        displayName: 'Smart Task Scheduler',
        description: 'Energy-aware prioritization with deep-work / quick-wins / low-energy time blocks',
        category: 'workflows',
        subcategory: 'scheduler',
        version: '0.1.0',
        status: 'available',
        priority: 'medium',
        dependencies: [],
        conflicts: [],
        provides: ['task-scheduling', 'time-blocking'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-scheduler',
          tags: ['scheduling', 'energy'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'security.scan',
        displayName: 'Security Scanner',
        description: 'Secrets and risky-pattern scanning (keys, eval, injection, privileged containers)',
        category: 'system',
        subcategory: 'secscan',
        version: '0.1.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['security-scan', 'secret-detection'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-secscan',
          tags: ['security', 'secrets'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'search.fulltext',
        displayName: 'Vault Full-Text Search',
        description: 'Tantivy-powered vault search with live indexing and tag filters',
        category: 'memory',
        subcategory: 'search',
        version: '0.1.0',
        status: 'available',
        priority: 'high',
        dependencies: ['memory.vault'],
        conflicts: [],
        provides: ['vault-search', 'fulltext', 'tag-filter'],
        requires: [
          { type: 'capability', name: 'memory.vault', optional: false, description: 'Vault access' }
        ],
        metadata: {
          source: 'builtin', pluginId: 'qeek-search',
          tags: ['search', 'tantivy'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'system.telemetry',
        displayName: 'Telemetry & Observability',
        description: 'In-memory meters with Prometheus/OTLP export and Grafana dashboard',
        category: 'system',
        subcategory: 'telemetry',
        version: '0.1.0',
        status: 'available',
        priority: 'medium',
        dependencies: [],
        conflicts: [],
        provides: ['metrics', 'traces', 'snapshot'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-telemetry',
          tags: ['otel', 'prometheus'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'system.hardware',
        displayName: 'System & Hardware Awareness',
        description: 'Local OS/CPU/memory/disk/GPU/battery/network/process insight with budget checks',
        category: 'system',
        subcategory: 'sysinfo',
        version: '0.1.0',
        status: 'available',
        priority: 'high',
        dependencies: [],
        conflicts: [],
        provides: ['sysinfo-snapshot', 'cpu', 'memory', 'disk', 'gpu', 'battery', 'network', 'budget-check'],
        requires: [],
        metadata: {
          source: 'builtin', pluginId: 'qeek-sysinfo',
          documentation: 'docs/capabilities/sysinfo.md',
          tags: ['hardware', 'local-only', 'no-network'], maturity: 'beta'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      }
    ];

    return builtin;
  }

  private async scanPluginCapabilities(): Promise<Capability[]> {
    const plugins = this.ctx.plugins || [];
    const capabilities: Capability[] = [];

    for (const plugin of plugins) {
      if (plugin.capabilities) {
        for (const cap of plugin.capabilities) {
          capabilities.push({
            ...cap,
            metadata: {
              ...cap.metadata,
              source: 'plugin',
              pluginId: plugin.id
            }
          });
        }
      }
    }

    return capabilities;
  }

  private async scanMCPCapabilities(): Promise<Capability[]> {
    const mcpServers = this.ctx.config?.mcpServers || {};
    const capabilities: Capability[] = [];

    for (const [name, config] of Object.entries(mcpServers)) {
      try {
        const serverCaps = await this.queryMCPCapabilities(name, config as any);
        capabilities.push(...serverCaps);
      } catch (e) {
        capabilities.push(this.createUnavailableMCPCapability(name, e));
      }
    }

    return capabilities;
  }

  private async queryMCPCapabilities(name: string, config: any): Promise<Capability[]> {
    return [{
      name: `mcp.${name}`,
      displayName: `MCP: ${name}`,
      description: `MCP server: ${name}`,
      category: 'communication',
      subcategory: 'mcp-server',
      version: '1.0.0',
      status: 'available',
      priority: 'medium',
      dependencies: ['mcp.client'],
      conflicts: [],
      provides: ['tools', 'resources', 'prompts'],
      requires: [
        { type: 'capability', name: 'mcp.client', optional: false, description: 'MCP client' }
      ],
      metadata: {
        source: 'mcp',
        mcpServer: name,
        tags: ['mcp', 'protocol'],
        maturity: 'stable'
      },
      health: this.createHealth('available'),
      discoveredAt: new Date(),
      lastVerified: new Date()
    }];
  }

  private createUnavailableMCPCapability(name: string, error: any): Capability {
    return {
      name: `mcp.${name}`,
      displayName: `MCP: ${name}`,
      description: `MCP server: ${name} (unavailable)`,
      category: 'communication',
      subcategory: 'mcp-server',
      version: 'unknown',
      status: 'unavailable',
      priority: 'low',
      dependencies: ['mcp.client'],
      conflicts: [],
      provides: [],
      requires: [
        { type: 'capability', name: 'mcp.client', optional: false, description: 'MCP client' }
      ],
      metadata: {
        source: 'mcp',
        mcpServer: name,
        tags: ['mcp', 'unavailable'],
        maturity: 'unknown'
      },
      health: {
        lastCheck: new Date(),
        successRate: 0,
        avgLatency: 0,
        errorCount: 1,
        warningCount: 0,
        details: { error: error?.message || 'Unknown error' }
      },
      discoveredAt: new Date(),
      lastVerified: new Date()
    };
  }

  private async scanExternalCapabilities(): Promise<Capability[]> {
    const capabilities: Capability[] = [];

    const externalChecks = [
      { name: 'docker', check: () => this.checkCommand('docker --version'), provides: ['container', 'sandbox'] },
      { name: 'git', check: () => this.checkCommand('git --version'), provides: ['version-control'] },
      { name: 'python', check: () => this.checkCommand('python --version'), provides: ['python-execution'] },
      { name: 'node', check: () => this.checkCommand('node --version'), provides: ['js-execution'] }
    ];

    for (const ext of externalChecks) {
      try {
        const version = await ext.check();
        capabilities.push({
          name: `external.${ext.name}`,
          displayName: `External: ${ext.name}`,
          description: `${ext.name} executable available`,
          category: 'system',
          subcategory: 'external-tool',
          version: version || 'unknown',
          status: 'available',
          priority: 'low',
          dependencies: [],
          conflicts: [],
          provides: ext.provides,
          requires: [],
          metadata: {
            source: 'external',
            executable: ext.name,
            tags: ['external', 'system'],
            maturity: 'stable'
          },
          health: this.createHealth('available'),
          discoveredAt: new Date(),
          lastVerified: new Date()
        });
      } catch {
        capabilities.push({
          name: `external.${ext.name}`,
          displayName: `External: ${ext.name}`,
          description: `${ext.name} not found`,
          category: 'system',
          subcategory: 'external-tool',
          version: 'unavailable',
          status: 'unavailable',
          priority: 'low',
          dependencies: [],
          conflicts: [],
          provides: [],
          requires: [],
          metadata: {
            source: 'external',
            executable: ext.name,
            tags: ['external', 'missing'],
            maturity: 'unknown'
          },
          health: this.createHealth('unavailable'),
          discoveredAt: new Date(),
          lastVerified: new Date()
        });
      }
    }

    return capabilities;
  }

  private async scanVirtualCapabilities(): Promise<Capability[]> {
    return [
      {
        name: 'virtual.reasoning',
        displayName: 'LLM Reasoning',
        description: 'Large language model reasoning capability',
        category: 'reasoning',
        subcategory: 'llm',
        version: '1.0.0',
        status: 'available',
        priority: 'critical',
        dependencies: ['llm.provider'],
        conflicts: [],
        provides: ['analysis', 'synthesis', 'planning', 'explanation'],
        requires: [
          { type: 'capability', name: 'llm.provider', optional: false, description: 'LLM provider' }
        ],
        metadata: {
          source: 'virtual',
          tags: ['llm', 'reasoning', 'core'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      },
      {
        name: 'virtual.planning',
        displayName: 'Task Planning',
        description: 'Decompose goals into executable plans',
        category: 'reasoning',
        subcategory: 'planning',
        version: '1.0.0',
        status: 'available',
        priority: 'high',
        dependencies: ['virtual.reasoning', 'tools'],
        conflicts: [],
        provides: ['decomposition', 'scheduling', 'dependency-resolution'],
        requires: [
          { type: 'capability', name: 'virtual.reasoning', optional: false, description: 'LLM reasoning' }
        ],
        metadata: {
          source: 'virtual',
          tags: ['planning', 'decomposition'],
          maturity: 'stable'
        },
        health: this.createHealth('available'),
        discoveredAt: new Date(),
        lastVerified: new Date()
      }
    ];
  }

  private async verifyCapabilities(capabilities: Capability[]): Promise<void> {
    for (const cap of capabilities) {
      if (cap.status === 'available') {
        try {
          await this.verifyCapability(cap);
          cap.health.lastCheck = new Date();
          cap.health.successRate = 1.0;
        } catch (e) {
          cap.status = 'degraded';
          cap.health.errorCount++;
          cap.health.details = { error: e instanceof Error ? e.message : String(e) };
        }
      }
    }
  }

  private async verifyCapability(cap: Capability): Promise<void> {
    switch (cap.metadata.source) {
      case 'mcp':
        break;
      case 'builtin':
        break;
      case 'external':
        await this.checkCommand(`${cap.metadata.executable} --version`);
        break;
    }
  }

  private async checkCommand(cmd: string): Promise<string | null> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
      return output.trim().split('\n')[0];
    } catch {
      throw new Error(`Command failed: ${cmd}`);
    }
  }

  private createHealth(status: CapabilityStatus): CapabilityHealth {
    return {
      lastCheck: new Date(),
      successRate: status === 'available' ? 1.0 : 0,
      avgLatency: 0,
      errorCount: 0,
      warningCount: 0
    };
  }

  private updateCache(capabilities: Capability[]): void {
    this.cache.clear();
    for (const cap of capabilities) {
      this.cache.set(cap.name, cap);
    }
  }

  getCachedCapabilities(): Capability[] {
    return Array.from(this.cache.values());
  }
}