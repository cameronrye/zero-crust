# ADR-004: Electron Security Configuration

## Status

Accepted

## Context

Electron applications combine a Node.js runtime with Chromium, creating a large attack surface. A compromised renderer process could potentially access the file system, network, or other system resources if not properly sandboxed.

Key threats for a POS application:
1. XSS attacks in renderer could access Node.js APIs
2. Malicious IPC messages could manipulate transactions
3. Navigation to untrusted URLs could load malicious content
4. Permissions (camera, location) could be exploited

## Decision

We implement defense-in-depth security following Electron's security checklist:

### 1. Electron Fuses (forge.config.ts)

Compile-time security flags that cannot be changed at runtime:

```typescript
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,              // Disable ELECTRON_RUN_AS_NODE
  [FuseV1Options.EnableCookieEncryption]: true,  // Encrypt cookies at rest
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,     // Prevent code injection
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
})
```

### 2. IPC Sender Validation (src/main/SecurityHandlers.ts)

All IPC messages are validated to ensure they originate from our application:

```typescript
export function validateSender(senderFrame: Electron.WebFrameMain): boolean {
  const url = senderFrame.url;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  return url.startsWith('file://');
}
```

### 3. Permission Blocking

All permission requests are denied by default:

```typescript
session.defaultSession.setPermissionRequestHandler(
  (webContents, permission, callback) => {
    logger.warn('Blocked permission request', { permission });
    callback(false);
  }
);
```

### 4. Navigation Control

Prevent navigation to untrusted URLs and block window.open:

```typescript
contents.on('will-navigate', (event, navigationUrl) => {
  if (!isAllowedNavigation(navigationUrl)) {
    event.preventDefault();
  }
});

contents.setWindowOpenHandler(({ url }) => {
  return { action: 'deny' };
});
```

### 5. Context Isolation

Enabled by default in Electron - renderer cannot access Node.js or preload globals directly.

### 6. Preload Script (src/preload.ts)

Minimal API exposed via contextBridge - renderers can only call predefined methods.

## Consequences

### Positive

- Defense in depth - multiple security layers
- Fuses provide compile-time guarantees
- IPC validation prevents spoofed messages
- Minimal API surface reduces attack vectors
- Permission blocking prevents capability abuse
- Navigation control prevents phishing/redirect attacks

### Negative

- Additional complexity for developers
- Cannot use some Electron features (e.g., remote module)
- Must update allowed origins when deployment changes

### Neutral

- Standard security practices for production Electron apps
- Some features disabled that would be useful for debugging (addressed via dev mode)

## Related Files

- `forge.config.ts` - Electron Fuses configuration (lines 119-135)
- `src/main/SecurityHandlers.ts` - Runtime security handlers
- `src/preload.ts` - Context bridge API
- `src/main/IpcHandlers.ts` - IPC sender validation

