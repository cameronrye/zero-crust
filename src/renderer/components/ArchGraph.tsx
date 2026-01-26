/**
 * ArchGraph - Node graph visualization for the Architecture Debug Window
 *
 * Displays the system architecture with nodes for:
 * - Main Process (center)
 * - Cashier Window (top-left)
 * - Customer Window (top-right)
 * - Transactions Window (bottom-left)
 * - Payment Gateway (bottom-right) - external payment processor
 *
 * Single edges between nodes change color based on event type.
 * Nodes pulse when sending/receiving events.
 * Payment events show special animations between Main and Gateway.
 * Failed payments trigger error animations (red glow).
 */
'use no memo'; // Opt-out of React Compiler due to animation state management

import { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BaseEdge,
  getStraightPath,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TraceEvent, TraceEventType } from '@shared/trace-types';
import { useAnimationState } from '../hooks/useAnimationState';

interface ArchGraphProps {
  /** Trace events to animate */
  events: TraceEvent[];
  /** Whether animations are paused */
  isPaused?: boolean;
  /** Animation speed multiplier (1 = normal) */
  animationSpeed?: number;
}

/** Animation duration in ms */
const PULSE_DURATION = 300;

/** Map source/target strings to node IDs */
function normalizeNodeId(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'main' || normalized === 'mainprocess') return 'main';
  if (normalized === 'cashier') return 'cashier';
  if (normalized === 'customer') return 'customer';
  if (normalized === 'transactions' || normalized === 'transaction history') return 'transactions';
  if (normalized === 'gateway' || normalized === 'payment' || normalized === 'paymentgateway') return 'gateway';
  if (normalized === 'all') return 'all'; // Special case for broadcasts
  return null;
}

/** Get pulse animation class based on event type, role, and success status */
function getPulseClass(
  eventType: TraceEventType,
  role: 'source' | 'target',
  isError?: boolean
): string {
  // Error state takes precedence
  if (isError) {
    return 'animate-pulse-error';
  }
  if (eventType === 'payment_start' || eventType === 'payment_complete') {
    return 'animate-pulse-payment';
  }
  return role === 'source' ? 'animate-pulse-send' : 'animate-pulse-receive';
}

/** Get edge color based on event type */
function getEdgeColor(eventType: TraceEventType): string {
  switch (eventType) {
    case 'command_received':
    case 'command_processed':
      return '#3b82f6'; // Blue
    case 'state_broadcast':
      return '#10b981'; // Green
    case 'payment_start':
    case 'payment_complete':
      return '#a855f7'; // Purple
    default:
      return '#f59e0b'; // Amber
  }
}

/** Node data interface - uses index signature for React Flow compatibility */
interface ArchNodeData extends Record<string, unknown> {
  label: string;
  color: string;
  pulseClass?: string;
  pulseKey?: number;
}

/** Custom node component for architecture nodes with pulse support */
function ArchNode({ data }: NodeProps<Node<ArchNodeData>>) {
  // Use pulseKey to trigger CSS animation replay
  const pulseClass = data.pulseClass;
  // Use stable key - only change when we have a new animation, use 0 as default
  const animationKey = data.pulseKey ?? 0;

  // Hide handles with inline style (invisible but functional for edge connections)
  const hiddenHandleStyle = { opacity: 0, width: 1, height: 1 };

  return (
    <div
      key={animationKey} // Force re-mount to replay animation
      className={`px-4 py-2 rounded-lg border-2 border-slate-600 shadow-lg ${pulseClass ?? ''}`}
      style={{ backgroundColor: data.color }}
    >
      {/* Hidden handles for edge connections */}
      <Handle id="top" type="source" position={Position.Top} style={hiddenHandleStyle} />
      <Handle id="top" type="target" position={Position.Top} style={hiddenHandleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={hiddenHandleStyle} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={hiddenHandleStyle} />
      <div className="text-white text-sm font-medium whitespace-nowrap">{data.label}</div>
    </div>
  );
}

const nodeTypes = { archNode: ArchNode };

/** Edge data interface for animated edges */
interface AnimatedEdgeData extends Record<string, unknown> {
  color?: string;
  isActive?: boolean;
  animationKey?: number;
}

/** Custom animated edge with traveling particle effect */
function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}: EdgeProps<Edge<AnimatedEdgeData>>) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const isActive = data?.isActive ?? false;
  const color = data?.color || (style?.stroke as string) || DEFAULT_EDGE_COLOR;
  const strokeWidth = isActive ? 4 : 2;
  // Use animationKey to force re-render and restart animation
  const animationKey = data?.animationKey ?? 0;

  return (
    <>
      {/* Base edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth,
          transition: 'stroke-width 0.15s ease, stroke 0.15s ease',
        }}
      />
      {/* Animated particle when active - key forces re-mount to restart animation */}
      {isActive && (
        <g key={animationKey}>
          <circle r="5" fill={color} filter="url(#glow)">
            <animateMotion
              dur="0.35s"
              repeatCount="1"
              path={edgePath}
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="1;1;0.8;0"
              dur="0.35s"
              repeatCount="1"
              fill="freeze"
            />
            <animate
              attributeName="r"
              values="5;6;4;3"
              dur="0.35s"
              repeatCount="1"
              fill="freeze"
            />
          </circle>
        </g>
      )}
    </>
  );
}

const edgeTypes = { animated: AnimatedEdge };

/** Default edge color when no event is active */
const DEFAULT_EDGE_COLOR = '#475569'; // slate-600

/**
 * Vertical stack layout - optimized for tall narrow container
 *
 * Layout:
 *        Cashier (top-left)      Customer (top-right)
 *              \                    /
 *               \                  /
 *                  Main Process (center)
 *                   /            \
 *                  /              \
 *        Transactions          Gateway
 *        (bottom-left)      (bottom-right)
 *
 * Single edges between nodes - color changes based on event type
 */
const BASE_NODES: Node<ArchNodeData>[] = [
  {
    id: 'cashier',
    type: 'archNode',
    position: { x: 0, y: 0 },
    data: { label: 'Cashier', color: '#065f46' },
  },
  {
    id: 'customer',
    type: 'archNode',
    position: { x: 180, y: 0 },
    data: { label: 'Customer', color: '#7c2d12' },
  },
  {
    id: 'main',
    type: 'archNode',
    position: { x: 90, y: 150 },
    data: { label: 'Main Process', color: '#1e40af' },
  },
  {
    id: 'transactions',
    type: 'archNode',
    position: { x: 0, y: 300 },
    data: { label: 'Transactions', color: '#4c1d95' },
  },
  {
    id: 'gateway',
    type: 'archNode',
    position: { x: 180, y: 300 },
    data: { label: 'Gateway', color: '#be185d' }, // Pink-700 for external service
  },
];

/** Single edges between nodes - uses custom animated edge type */
const BASE_EDGES: Edge<AnimatedEdgeData>[] = [
  // Cashier <-> Main
  { id: 'cashier-main', type: 'animated', source: 'cashier', target: 'main', sourceHandle: 'bottom', targetHandle: 'top', data: { isActive: false } },
  // Customer <-> Main
  { id: 'customer-main', type: 'animated', source: 'customer', target: 'main', sourceHandle: 'bottom', targetHandle: 'top', data: { isActive: false } },
  // Main <-> Transactions
  { id: 'main-transactions', type: 'animated', source: 'main', target: 'transactions', sourceHandle: 'bottom', targetHandle: 'top', data: { isActive: false } },
  // Main <-> Gateway (payment processing)
  { id: 'main-gateway', type: 'animated', source: 'main', target: 'gateway', sourceHandle: 'bottom', targetHandle: 'top', data: { isActive: false } },
];

/** Map edge IDs for broadcast events (main -> all windows, excludes gateway) */
const BROADCAST_EDGES = ['cashier-main', 'customer-main', 'main-transactions'];

/** Get edge ID for a source-target pair (handles bidirectional mapping) */
function getEdgeId(source: string, target: string): string | null {
  // Map to our simplified edge IDs
  if ((source === 'cashier' && target === 'main') || (source === 'main' && target === 'cashier')) {
    return 'cashier-main';
  }
  if ((source === 'customer' && target === 'main') || (source === 'main' && target === 'customer')) {
    return 'customer-main';
  }
  if ((source === 'main' && target === 'transactions') || (source === 'transactions' && target === 'main')) {
    return 'main-transactions';
  }
  if ((source === 'main' && target === 'gateway') || (source === 'gateway' && target === 'main')) {
    return 'main-gateway';
  }
  return null;
}

/** Check if a payment_complete event represents a failure */
function isPaymentError(event: TraceEvent): boolean {
  if (event.type !== 'payment_complete') return false;
  const payload = event.payload as { success?: boolean } | undefined;
  return payload?.success === false;
}

/** Get edge color based on event type and error state */
function getEdgeColorForEvent(event: TraceEvent): string {
  if (isPaymentError(event)) {
    return '#ef4444'; // Red for errors
  }
  return getEdgeColor(event.type);
}

/** Process a trace event into animation triggers */
function processEventForAnimations(event: TraceEvent): {
  nodes: Array<{ id: string; pulseClass: string }>;
  edges: Array<{ id: string; color: string }>;
} {
  const sourceNode = normalizeNodeId(event.source);
  const targetNode = normalizeNodeId(event.target);
  const nodes: Array<{ id: string; pulseClass: string }> = [];
  const edges: Array<{ id: string; color: string }> = [];
  const isError = isPaymentError(event);
  const edgeColor = getEdgeColorForEvent(event);

  // Add source node pulse
  if (sourceNode && sourceNode !== 'all') {
    nodes.push({ id: sourceNode, pulseClass: getPulseClass(event.type, 'source', isError) });
  }

  // Add target node pulse(s) and edge flash(es)
  if (targetNode) {
    if (targetNode === 'all') {
      // Broadcast to all windows
      for (const target of ['cashier', 'customer', 'transactions']) {
        nodes.push({ id: target, pulseClass: getPulseClass(event.type, 'target', isError) });
      }
      // Flash all edges for broadcast
      for (const edgeId of BROADCAST_EDGES) {
        edges.push({ id: edgeId, color: edgeColor });
      }
    } else {
      nodes.push({ id: targetNode, pulseClass: getPulseClass(event.type, 'target', isError) });
      // Flash the edge between source and target
      if (sourceNode && sourceNode !== 'all') {
        const edgeId = getEdgeId(sourceNode, targetNode);
        if (edgeId) {
          edges.push({ id: edgeId, color: edgeColor });
        }
      }
    }
  }

  return { nodes, edges };
}

/** Processor function - stable reference to avoid hook dependency changes */
function processEventForHook(event: TraceEvent): {
  nodes: Array<{ id: string; data: { pulseClass: string } }>;
  edges: Array<{ id: string; data: { color: string } }>;
} {
  const result = processEventForAnimations(event);
  return {
    nodes: result.nodes.map(n => ({ id: n.id, data: { pulseClass: n.pulseClass } })),
    edges: result.edges.map(e => ({ id: e.id, data: { color: e.color } })),
  };
}

/** Inner component that has access to ReactFlow instance */
function ArchGraphInner({ events, isPaused = false, animationSpeed = 1 }: ArchGraphProps) {
  const animDuration = PULSE_DURATION / animationSpeed;
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Use animation state hook for nodes and edges
  const { activeNodes, activeEdges } = useAnimationState(
    events,
    processEventForHook,
    animDuration,
    isPaused
  );

  // Fit view on initial load
  const onInit = useCallback(() => {
    fitView({ padding: 0.1, minZoom: 0.5, maxZoom: 3 });
  }, [fitView]);

  // Re-fit view on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      // Skip fitView if container has zero dimensions to prevent visualization disappearing
      if (width === 0 || height === 0) return;

      // Debounce the fitView call
      requestAnimationFrame(() => {
        fitView({ padding: 0.1, minZoom: 0.5, maxZoom: 3 });
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [fitView]);

  // Build nodes with animation state
  const nodes = useMemo(() => {
    return BASE_NODES.map(node => {
      const active = activeNodes.get(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          pulseClass: active?.data.pulseClass,
          pulseKey: active?.key,
        },
      };
    });
  }, [activeNodes]);

  // Build edges with animation state
  const edges = useMemo(() => {
    return BASE_EDGES.map(edge => {
      const active = activeEdges.get(edge.id);
      const isActive = !!active;
      const color = active?.data.color || DEFAULT_EDGE_COLOR;
      return {
        ...edge,
        style: {
          stroke: color,
          strokeWidth: isActive ? 4 : 2,
        },
        data: {
          ...edge.data,
          isActive,
          color,
          animationKey: active?.key,
        },
      };
    });
  }, [activeEdges]);

  return (
    <div ref={containerRef} className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        {/* SVG filter for particle glow effect */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <Background color="#334155" gap={20} />
      </ReactFlow>
    </div>
  );
}

/** Wrapper component that provides ReactFlow context */
export function ArchGraph(props: ArchGraphProps) {
  return (
    <ReactFlowProvider>
      <ArchGraphInner {...props} />
    </ReactFlowProvider>
  );
}

