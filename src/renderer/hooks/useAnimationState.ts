/**
 * useAnimationState - Hook for managing timed animation state
 *
 * Provides a way to trigger animations that auto-expire after a duration.
 * Uses useEffect to process new items without violating React render rules.
 *
 * @example
 * ```tsx
 * const { activeItems } = useAnimationState(events, processEvent, 300);
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface AnimationItem<T> {
  data: T;
  key: number;
}

/**
 * Hook for managing animation state with auto-expiration
 * Processes items from a source array and triggers animations.
 *
 * @param items - Source items to process
 * @param processItem - Function to convert a source item to animation triggers
 * @param duration - How long animations should stay active (ms)
 * @param isPaused - Whether to pause processing new items
 */
export function useAnimationState<TSource, TNodeData, TEdgeData>(
  items: TSource[],
  processItem: (item: TSource) => {
    nodes: Array<{ id: string; data: TNodeData }>;
    edges: Array<{ id: string; data: TEdgeData }>;
  },
  duration: number,
  isPaused: boolean = false
): {
  activeNodes: Map<string, AnimationItem<TNodeData>>;
  activeEdges: Map<string, AnimationItem<TEdgeData>>;
  clearAll: () => void;
} {
  const [activeNodes, setActiveNodes] = useState<Map<string, AnimationItem<TNodeData>>>(new Map());
  const [activeEdges, setActiveEdges] = useState<Map<string, AnimationItem<TEdgeData>>>(new Map());
  const lastProcessedRef = useRef(0);
  const nodeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const edgeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const keyCounterRef = useRef(0);

  // Process new items in an effect
  useEffect(() => {
    if (isPaused) return;

    const itemsLength = items.length;
    if (itemsLength <= lastProcessedRef.current) return;

    const newItems = items.slice(lastProcessedRef.current);
    lastProcessedRef.current = itemsLength;

    for (const item of newItems) {
      const { nodes, edges } = processItem(item);

      // Trigger node animations
      for (const node of nodes) {
        const key = ++keyCounterRef.current;

        // Clear existing timer
        const existingTimer = nodeTimersRef.current.get(node.id);
        if (existingTimer) clearTimeout(existingTimer);

        // Set active
        setActiveNodes(prev => {
          const next = new Map(prev);
          next.set(node.id, { data: node.data, key });
          return next;
        });

        // Set expiration timer
        const timer = setTimeout(() => {
          setActiveNodes(prev => {
            const next = new Map(prev);
            const current = next.get(node.id);
            if (current && current.key === key) {
              next.delete(node.id);
            }
            return next;
          });
          nodeTimersRef.current.delete(node.id);
        }, duration);
        nodeTimersRef.current.set(node.id, timer);
      }

      // Trigger edge animations
      for (const edge of edges) {
        const key = ++keyCounterRef.current;

        // Clear existing timer
        const existingTimer = edgeTimersRef.current.get(edge.id);
        if (existingTimer) clearTimeout(existingTimer);

        // Set active
        setActiveEdges(prev => {
          const next = new Map(prev);
          next.set(edge.id, { data: edge.data, key });
          return next;
        });

        // Set expiration timer
        const timer = setTimeout(() => {
          setActiveEdges(prev => {
            const next = new Map(prev);
            const current = next.get(edge.id);
            if (current && current.key === key) {
              next.delete(edge.id);
            }
            return next;
          });
          edgeTimersRef.current.delete(edge.id);
        }, duration);
        edgeTimersRef.current.set(edge.id, timer);
      }
    }
  }, [items, processItem, duration, isPaused]);

  // Reset when items are cleared
  useEffect(() => {
    if (items.length === 0) {
      lastProcessedRef.current = 0;
    }
  }, [items.length]);

  const clearAll = useCallback(() => {
    // Clear all timers
    for (const timer of nodeTimersRef.current.values()) clearTimeout(timer);
    for (const timer of edgeTimersRef.current.values()) clearTimeout(timer);
    nodeTimersRef.current.clear();
    edgeTimersRef.current.clear();
    setActiveNodes(new Map());
    setActiveEdges(new Map());
    lastProcessedRef.current = 0;
  }, []);

  return { activeNodes, activeEdges, clearAll };
}

