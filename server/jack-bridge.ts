/**
 * JACK Audio Bridge
 * WebSocket bridge for JACK audio server integration.
 * Only enabled when JACK_BRIDGE_ENABLED=true environment variable is set.
 *
 * Provides:
 * - JACK server status monitoring
 * - Port enumeration
 * - Port connection/disconnection
 */

import { WebSocket, WebSocketServer } from 'ws';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface JackPort {
  name: string;
  clientName: string;
  portName: string;
  type: 'audio' | 'midi';
  direction: 'input' | 'output';
  isPhysical: boolean;
  connections: string[];
}

export interface JackServerState {
  isConnected: boolean;
  isRunning: boolean;
  sampleRate: number;
  bufferSize: number;
  cpuLoad: number;
  xruns: number;
  ports: JackPort[];
}

interface JackBridgeMessage {
  type: string;
  data?: any;
  error?: string;
}

interface JackBridgeCommand {
  command: string;
  args?: any;
}

const DEFAULT_STATE: JackServerState = {
  isConnected: false,
  isRunning: false,
  sampleRate: 0,
  bufferSize: 0,
  cpuLoad: 0,
  xruns: 0,
  ports: [],
};

export class JackBridge {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private state: JackServerState = { ...DEFAULT_STATE };
  private pollInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.JACK_BRIDGE_ENABLED === 'true';
  }

  /**
   * Initialize the JACK bridge WebSocket server
   */
  async initialize(port: number = 5001): Promise<void> {
    if (!this.isEnabled) {
      console.log('JACK Bridge: Disabled (set JACK_BRIDGE_ENABLED=true to enable)');
      return;
    }

    // Check if JACK tools are available
    const jackAvailable = await this.checkJackAvailable();
    if (!jackAvailable) {
      console.log('JACK Bridge: JACK tools not found, bridge disabled');
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    this.wss.on('error', (error) => {
      console.error('JACK Bridge WebSocket error:', error);
    });

    // Start polling JACK status
    this.startPolling();

    console.log(`JACK Bridge: WebSocket server listening on port ${port}`);
  }

  /**
   * Check if JACK tools are available on the system
   */
  private async checkJackAvailable(): Promise<boolean> {
    try {
      await execAsync('which jack_lsp');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    // Send current state on connection
    this.sendMessage(ws, { type: 'state', data: this.state });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as JackBridgeCommand;
        await this.handleCommand(ws, message);
      } catch (error) {
        this.sendMessage(ws, {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('JACK Bridge client error:', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Handle incoming command from client
   */
  private async handleCommand(ws: WebSocket, message: JackBridgeCommand): Promise<void> {
    switch (message.command) {
      case 'getState':
        await this.refreshState();
        this.sendMessage(ws, { type: 'state', data: this.state });
        break;

      case 'connect':
        if (message.args?.source && message.args?.destination) {
          const success = await this.connectPorts(message.args.source, message.args.destination);
          this.sendMessage(ws, {
            type: 'connectResult',
            data: { success, source: message.args.source, destination: message.args.destination },
          });
        }
        break;

      case 'disconnect':
        if (message.args?.source && message.args?.destination) {
          const success = await this.disconnectPorts(message.args.source, message.args.destination);
          this.sendMessage(ws, {
            type: 'disconnectResult',
            data: { success, source: message.args.source, destination: message.args.destination },
          });
        }
        break;

      case 'listPorts':
        const ports = await this.listPorts();
        this.sendMessage(ws, { type: 'ports', data: ports });
        break;

      default:
        this.sendMessage(ws, { type: 'error', error: `Unknown command: ${message.command}` });
    }
  }

  /**
   * Send message to a WebSocket client
   */
  private sendMessage(ws: WebSocket, message: JackBridgeMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: JackBridgeMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Start polling JACK server status
   */
  private startPolling(): void {
    // Poll every 2 seconds
    this.pollInterval = setInterval(async () => {
      await this.refreshState();
    }, 2000);

    // Initial refresh
    this.refreshState();
  }

  /**
   * Refresh JACK server state
   */
  private async refreshState(): Promise<void> {
    const previousState = { ...this.state };

    try {
      // Check if JACK is running
      const isRunning = await this.isJackRunning();
      this.state.isRunning = isRunning;
      this.state.isConnected = isRunning;

      if (isRunning) {
        // Get JACK info
        const info = await this.getJackInfo();
        this.state.sampleRate = info.sampleRate;
        this.state.bufferSize = info.bufferSize;
        this.state.cpuLoad = info.cpuLoad;
        this.state.xruns = info.xruns;

        // Get ports
        this.state.ports = await this.listPorts();
      } else {
        this.state = { ...DEFAULT_STATE };
      }

      // Broadcast if state changed significantly
      if (
        previousState.isRunning !== this.state.isRunning ||
        previousState.ports.length !== this.state.ports.length
      ) {
        this.broadcast({ type: 'state', data: this.state });
      }
    } catch (error) {
      console.error('JACK Bridge: Error refreshing state:', error);
      this.state = { ...DEFAULT_STATE };
    }
  }

  /**
   * Check if JACK server is running
   */
  private async isJackRunning(): Promise<boolean> {
    try {
      await execAsync('jack_lsp');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get JACK server info using jack_cpu_load
   */
  private async getJackInfo(): Promise<{
    sampleRate: number;
    bufferSize: number;
    cpuLoad: number;
    xruns: number;
  }> {
    try {
      // Get sample rate and buffer size
      const { stdout: srOutput } = await execAsync('jack_samplerate');
      const sampleRate = parseInt(srOutput.trim(), 10) || 48000;

      const { stdout: bsOutput } = await execAsync('jack_bufsize');
      const bufferSize = parseInt(bsOutput.trim(), 10) || 256;

      // CPU load would require jack_cpu_load or parsing jackdbus
      // For now, return 0
      return {
        sampleRate,
        bufferSize,
        cpuLoad: 0,
        xruns: 0,
      };
    } catch {
      return {
        sampleRate: 48000,
        bufferSize: 256,
        cpuLoad: 0,
        xruns: 0,
      };
    }
  }

  /**
   * List all JACK ports
   */
  private async listPorts(): Promise<JackPort[]> {
    try {
      // Get all ports with properties
      const { stdout } = await execAsync('jack_lsp -c -t -p');
      return this.parseJackLspOutput(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Parse jack_lsp output into structured port data
   */
  private parseJackLspOutput(output: string): JackPort[] {
    const ports: JackPort[] = [];
    const lines = output.split('\n');

    let currentPort: Partial<JackPort> | null = null;
    let readingConnections = false;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Port name line (no leading whitespace)
      if (!line.startsWith('\t') && !line.startsWith(' ')) {
        if (currentPort && currentPort.name) {
          ports.push(currentPort as JackPort);
        }

        const [clientName, portName] = line.split(':');
        currentPort = {
          name: line,
          clientName: clientName || '',
          portName: portName || '',
          type: 'audio',
          direction: 'output',
          isPhysical: false,
          connections: [],
        };
        readingConnections = false;
      } else if (currentPort) {
        const trimmed = line.trim();

        // Property line
        if (trimmed.includes('properties:')) {
          const props = trimmed.toLowerCase();
          currentPort.isPhysical = props.includes('physical');
          currentPort.direction = props.includes('input') ? 'input' : 'output';
        }
        // Type line
        else if (trimmed.startsWith('32 bit float')) {
          currentPort.type = 'audio';
        } else if (trimmed.includes('midi')) {
          currentPort.type = 'midi';
        }
        // Connection line (connected ports are indented)
        else if (line.startsWith('\t') && currentPort.connections) {
          currentPort.connections.push(trimmed);
        }
      }
    }

    // Don't forget the last port
    if (currentPort && currentPort.name) {
      ports.push(currentPort as JackPort);
    }

    return ports;
  }

  /**
   * Connect two JACK ports
   */
  private async connectPorts(source: string, destination: string): Promise<boolean> {
    try {
      await execAsync(`jack_connect "${source}" "${destination}"`);
      await this.refreshState();
      return true;
    } catch (error) {
      console.error(`JACK Bridge: Failed to connect ${source} -> ${destination}:`, error);
      return false;
    }
  }

  /**
   * Disconnect two JACK ports
   */
  private async disconnectPorts(source: string, destination: string): Promise<boolean> {
    try {
      await execAsync(`jack_disconnect "${source}" "${destination}"`);
      await this.refreshState();
      return true;
    } catch (error) {
      console.error(`JACK Bridge: Failed to disconnect ${source} -> ${destination}:`, error);
      return false;
    }
  }

  /**
   * Shutdown the JACK bridge
   */
  shutdown(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('JACK Bridge: Shutdown complete');
  }
}

// Singleton instance
export const jackBridge = new JackBridge();
