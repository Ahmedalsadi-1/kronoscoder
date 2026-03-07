import fs from 'fs';
import path from 'path';
import {
  CONFIG_FILE,
  AGENT_SCOPE,
  readConfigFile,
  readConfigLayers,
  getJsonEntrySource,
  getJsonWriteTarget,
  writeConfig,
} from './shared.js';
import {
  buildMcpPolicyMetadata,
  disallowedMcpPolicyMessage,
  isMcpPolicyAllowed,
  normalizeMcpPolicyName,
} from './mcp-policy.js';

// ============== MCP CONFIG HELPERS ==============
const MCP_QUARANTINE_KEY = 'mcpPolicyQuarantine';

/**
 * Validate MCP server name
 */
function validateMcpName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('MCP server name is required');
  }
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
    throw new Error('MCP server name must be lowercase alphanumeric with hyphens/underscores');
  }
}

function ensureAllowedMcpName(name) {
  const normalized = normalizeMcpPolicyName(name);
  if (!normalized || !isMcpPolicyAllowed(normalized)) {
    throw new Error(disallowedMcpPolicyMessage(name));
  }
  validateMcpName(normalized);
  return normalized;
}

function normalizeQuarantine(existing) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return {};
  }
  return { ...existing };
}

function sanitizeMcpPolicyInConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const mcp = config.mcp;
  if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp)) {
    return false;
  }

  const next = {};
  const quarantine = normalizeQuarantine(config[MCP_QUARANTINE_KEY]);
  const now = new Date().toISOString();
  let changed = false;

  for (const [name, entry] of Object.entries(mcp)) {
    const normalizedName = normalizeMcpPolicyName(name);
    if (!normalizedName || !isMcpPolicyAllowed(normalizedName)) {
      quarantine[name] = {
        name,
        normalizedName: normalizedName || null,
        entry,
        quarantinedAt: now,
        reason: disallowedMcpPolicyMessage(name),
      };
      changed = true;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(next, normalizedName)) {
      quarantine[name] = {
        name,
        normalizedName,
        entry,
        quarantinedAt: now,
        reason: `Duplicate MCP entry collapsed into "${normalizedName}" by policy sanitizer.`,
      };
      changed = true;
      continue;
    }

    if (normalizedName !== name) {
      changed = true;
    }
    next[normalizedName] = entry;
  }

  if (!changed) {
    return false;
  }

  if (Object.keys(next).length > 0) {
    config.mcp = next;
  } else {
    delete config.mcp;
  }

  if (Object.keys(quarantine).length > 0) {
    config[MCP_QUARANTINE_KEY] = quarantine;
  } else {
    delete config[MCP_QUARANTINE_KEY];
  }

  return true;
}

function sanitizeMcpPolicyAcrossLayers(layers) {
  if (!layers || typeof layers !== 'object') {
    return;
  }

  const candidates = [
    { path: layers.paths?.userPath, config: layers.userConfig },
    { path: layers.paths?.projectPath, config: layers.projectConfig },
    { path: layers.paths?.customPath, config: layers.customConfig },
  ];

  const seenPaths = new Set();
  for (const candidate of candidates) {
    if (!candidate.path || seenPaths.has(candidate.path)) {
      continue;
    }
    seenPaths.add(candidate.path);
    if (!candidate.config || typeof candidate.config !== 'object' || Array.isArray(candidate.config)) {
      continue;
    }
    if (!sanitizeMcpPolicyInConfig(candidate.config)) {
      continue;
    }
    writeConfig(candidate.config, candidate.path);
  }
}

/**
 * List all MCP server configs from user-level kronoscode.json
 */
function resolveMcpScopeFromPath(layers, sourcePath) {
  if (!sourcePath) return null;
  return sourcePath === layers.paths.projectPath ? AGENT_SCOPE.PROJECT : AGENT_SCOPE.USER;
}

function ensureProjectMcpConfigPath(workingDirectory) {
  const configDir = path.join(workingDirectory, '.kronoscode');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'kronoscode.json');
}

function listMcpConfigs(workingDirectory) {
  const layers = readConfigLayers(workingDirectory);
  sanitizeMcpPolicyAcrossLayers(layers);
  const mcp = layers?.mergedConfig?.mcp || {};

  return Object.entries(mcp)
    .filter(([name, entry]) => isMcpPolicyAllowed(name) && entry && typeof entry === 'object' && !Array.isArray(entry))
    .map(([rawName, entry]) => {
      const name = normalizeMcpPolicyName(rawName);
      const source = getJsonEntrySource(layers, 'mcp', name);
      return {
        name,
        ...buildMcpEntry(entry),
        scope: resolveMcpScopeFromPath(layers, source.path),
      };
    });
}

/**
 * Get a single MCP server config by name
 */
function getMcpConfig(name, workingDirectory) {
  const normalizedName = ensureAllowedMcpName(name);
  const layers = readConfigLayers(workingDirectory);
  sanitizeMcpPolicyAcrossLayers(layers);
  const entry = layers?.mergedConfig?.mcp?.[normalizedName];

  if (!entry) {
    return null;
  }
  const source = getJsonEntrySource(layers, 'mcp', normalizedName);
  return {
    name: normalizedName,
    ...buildMcpEntry(entry),
    scope: resolveMcpScopeFromPath(layers, source.path),
  };
}

/**
 * Create a new MCP server config entry
 */
function createMcpConfig(name, mcpConfig, workingDirectory, scope) {
  const normalizedName = ensureAllowedMcpName(name);

  const layers = readConfigLayers(workingDirectory);
  sanitizeMcpPolicyAcrossLayers(layers);
  const source = getJsonEntrySource(layers, 'mcp', normalizedName);
  if (source.exists) {
    throw new Error(`MCP server "${normalizedName}" already exists`);
  }

  let targetPath = CONFIG_FILE;
  let config = {};

  if (scope === AGENT_SCOPE.PROJECT) {
    if (!workingDirectory) {
      throw new Error('Project scope requires working directory');
    }
    targetPath = ensureProjectMcpConfigPath(workingDirectory);
    config = fs.existsSync(targetPath) ? readConfigFile(targetPath) : {};
  } else {
    const jsonTarget = getJsonWriteTarget(layers, AGENT_SCOPE.USER);
    targetPath = jsonTarget.path || CONFIG_FILE;
    config = jsonTarget.config || {};
  }

  if (!config.mcp || typeof config.mcp !== 'object' || Array.isArray(config.mcp)) {
    config.mcp = {};
  }

  const { name: _ignoredName, ...entryData } = mcpConfig;
  config.mcp[normalizedName] = buildMcpEntry(entryData);

  sanitizeMcpPolicyInConfig(config);
  writeConfig(config, targetPath);
  console.log(`Created MCP server config: ${normalizedName}`);
}

/**
 * Update an existing MCP server config entry
 */
function updateMcpConfig(name, updates, workingDirectory) {
  const normalizedName = ensureAllowedMcpName(name);
  const layers = readConfigLayers(workingDirectory);
  sanitizeMcpPolicyAcrossLayers(layers);
  const source = getJsonEntrySource(layers, 'mcp', normalizedName);
  const targetPath = source.path || CONFIG_FILE;
  const config = source.config || (fs.existsSync(targetPath) ? readConfigFile(targetPath) : {});

  if (!config.mcp || typeof config.mcp !== 'object' || Array.isArray(config.mcp)) {
    config.mcp = {};
  }

  const existing = config.mcp[normalizedName] ?? {};
  const { name: _ignoredName, ...updateData } = updates;

  config.mcp[normalizedName] = buildMcpEntry({ ...existing, ...updateData });

  sanitizeMcpPolicyInConfig(config);
  writeConfig(config, targetPath);
  console.log(`Updated MCP server config: ${normalizedName}`);
}

/**
 * Delete an MCP server config entry
 */
function deleteMcpConfig(name, workingDirectory) {
  const normalizedName = ensureAllowedMcpName(name);
  const layers = readConfigLayers(workingDirectory);
  sanitizeMcpPolicyAcrossLayers(layers);
  const source = getJsonEntrySource(layers, 'mcp', normalizedName);
  const targetPath = source.path || CONFIG_FILE;
  const config = source.config || (fs.existsSync(targetPath) ? readConfigFile(targetPath) : {});

  if (!config.mcp || typeof config.mcp !== 'object' || config.mcp[normalizedName] === undefined) {
    throw new Error(`MCP server "${normalizedName}" not found`);
  }

  delete config.mcp[normalizedName];

  if (Object.keys(config.mcp).length === 0) {
    delete config.mcp;
  }

  sanitizeMcpPolicyInConfig(config);
  writeConfig(config, targetPath);
  console.log(`Deleted MCP server config: ${normalizedName}`);
}

/**
 * Build a clean MCP entry object, omitting undefined/null values
 */
function buildMcpEntry(data) {
  const entry = {};

  // type is required
  entry.type = data.type === 'remote' ? 'remote' : 'local';

  if (entry.type === 'local') {
    // command must be a non-empty array of strings
    if (Array.isArray(data.command) && data.command.length > 0) {
      entry.command = data.command.map(String);
    }
  } else {
    // remote: url required
    if (data.url && typeof data.url === 'string') {
      entry.url = data.url.trim();
    }
  }

  // environment: flat Record<string, string>
  if (data.environment && typeof data.environment === 'object' && !Array.isArray(data.environment)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(data.environment)) {
      if (k && v !== undefined && v !== null) {
        cleaned[k] = String(v);
      }
    }
    if (Object.keys(cleaned).length > 0) {
      entry.environment = cleaned;
    }
  }

  // enabled defaults to true
  entry.enabled = data.enabled !== false;

  return entry;
}

export {
  listMcpConfigs,
  getMcpConfig,
  createMcpConfig,
  updateMcpConfig,
  deleteMcpConfig,
  buildMcpPolicyMetadata,
};
