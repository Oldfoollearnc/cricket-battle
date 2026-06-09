/**
 * Canvas 组件 - PixiJS 画布包装器
 * 初始化 CanvasManager、InteractionManager，绑定渲染循环
 * 将 React 状态变化同步到 PixiJS 渲染层
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { CanvasManager } from '../canvas/CanvasManager';
import { InteractionManager } from '../canvas/InteractionManager';
import { renderNode, RenderedNode } from '../canvas/NodeRenderer';
import { renderConnections } from '../canvas/ConnectionRenderer';
import { useCanvasStore } from '../store/canvasStore';
import { Connection, Value } from '../types';

const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const interactionRef = useRef<InteractionManager | null>(null);
  const renderedNodesRef = useRef<Map<string, RenderedNode>>(new Map());
  const connectionsGfxRef = useRef<PIXI.Graphics | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const prevNodesJsonRef = useRef<string>('');
  const prevConnsJsonRef = useRef<string>('');

  const {
    nodes,
    connections,
    updateNodePosition,
    addConnection,
    selectNode,
    executeAll,
  } = useCanvasStore();

  const handleNodeDragEnd = useCallback(
    (nodeId: string, x: number, y: number) => {
      updateNodePosition(nodeId, x, y);
    },
    [updateNodePosition]
  );

  const handleConnectionCreated = useCallback(
    (conn: Connection) => {
      addConnection(conn);
    },
    [addConnection]
  );

  const handleNodeSelected = useCallback(
    (nodeId: string | null) => {
      selectNode(nodeId);
    },
    [selectNode]
  );

  const handleNodeValueChange = useCallback(
    (_nodeId: string, _portName: string, _value: Value) => {
      // 由 NodePanel 组件处理
    },
    []
  );

  const handleRequestExecute = useCallback(() => {
    executeAll();
  }, [executeAll]);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;

    const cm = new CanvasManager(containerRef.current);
    canvasManagerRef.current = cm;

    const im = new InteractionManager(cm, {
      onNodeDragEnd: handleNodeDragEnd,
      onConnectionCreated: handleConnectionCreated,
      onNodeSelected: handleNodeSelected,
      onNodeValueChange: handleNodeValueChange,
      onRequestExecute: handleRequestExecute,
    });
    interactionRef.current = im;

    // 创建节点容器
    const nodesContainer = new PIXI.Container();
    nodesContainer.name = '__nodes__';
    cm.worldContainer.addChild(nodesContainer);
    nodesContainerRef.current = nodesContainer;

    // 渲染循环
    const ticker = () => {
      im.update();
      syncConnections();
    };
    cm.app.ticker.add(ticker);

    // 响应式缩放
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        cm.resize(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cm.app.ticker.remove(ticker);
      resizeObserver.disconnect();
      im.setRenderedNodes(new Map());
      cm.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 同步节点渲染
  useEffect(() => {
    const cm = canvasManagerRef.current;
    const im = interactionRef.current;
    const container = nodesContainerRef.current;
    if (!cm || !im || !container) return;

    const nodesJson = JSON.stringify(
      nodes.map((n) => ({
        id: n.id,
        type: n.type,
        pos: n.position,
        inputs: Object.fromEntries(n.inputs),
        outputs: Object.fromEntries(n.outputs),
        status: n.status,
      }))
    );
    if (nodesJson === prevNodesJsonRef.current) return;
    prevNodesJsonRef.current = nodesJson;

    const rendered = renderedNodesRef.current;

    // 删除不存在的节点
    for (const [id, rn] of rendered) {
      if (!nodes.find((n) => n.id === id)) {
        container.removeChild(rn.container);
        rn.container.destroy({ children: true });
        rendered.delete(id);
      }
    }

    // 更新或创建节点
    for (const node of nodes) {
      const existing = rendered.get(node.id);
      if (existing) {
        existing.update(node);
      } else {
        const rn = renderNode(node);
        container.addChild(rn.container);
        im.bindNodeInteraction(rn);
        rendered.set(node.id, rn);
      }
    }

    im.setRenderedNodes(rendered);
  }, [nodes]);

  // 同步连线渲染
  const syncConnections = useCallback(() => {
    const cm = canvasManagerRef.current;
    if (!cm) return;

    const connsJson = JSON.stringify(connections);
    if (connsJson === prevConnsJsonRef.current) return;
    prevConnsJsonRef.current = connsJson;

    // 移除旧连线
    if (connectionsGfxRef.current) {
      cm.worldContainer.removeChild(connectionsGfxRef.current);
      connectionsGfxRef.current.destroy();
    }

    // 渲染新连线
    const gfx = renderConnections(connections, (nodeId, portName, isOutput) => {
      const rendered = renderedNodesRef.current.get(nodeId);
      if (!rendered) return null;
      const positions = isOutput ? rendered.outputPortPositions : rendered.inputPortPositions;
      return positions.get(portName) ?? null;
    });

    // 连线在节点下方
    cm.worldContainer.addChildAt(gfx, 1);
    connectionsGfxRef.current = gfx;
  }, [connections]);

  useEffect(() => {
    prevConnsJsonRef.current = ''; // force re-render
    syncConnections();
  }, [connections, syncConnections]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
};

export default Canvas;
