/**
 * Canvas 组件 - PixiJS 画布包装器
 * 初始化 CanvasManager、InteractionManager、OverlayManager、MinimapRenderer
 * 绑定渲染循环，将 React 状态变化同步到 PixiJS 渲染层
 * 管理 HTML Overlay 层用于多模态输出
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { CanvasManager } from '../canvas/CanvasManager';
import { InteractionManager } from '../canvas/InteractionManager';
import { OverlayManager, OverlayPosition } from '../canvas/OverlayManager';
import { MinimapRenderer } from '../canvas/MinimapRenderer';
import { renderNode, RenderedNode } from '../canvas/NodeRenderer';
import { renderConnections } from '../canvas/ConnectionRenderer';
import { useCanvasStore } from '../store/canvasStore';
import { useCollabStore } from '../store/collabStore';
import { useSettingsStore } from '../store/settingsStore';
import OutputRenderer, { isOutputNode } from '../output/OutputRenderer';
import RecommendationPanel from '../intelligence/RecommendationPanel';
import { Connection, Value } from '../types';
import { recordNodeUsage } from '../intelligence/RecommendationEngine';

const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const interactionRef = useRef<InteractionManager | null>(null);
  const overlayManagerRef = useRef<OverlayManager | null>(null);
  const minimapRef = useRef<MinimapRenderer | null>(null);
  const renderedNodesRef = useRef<Map<string, RenderedNode>>(new Map());
  const connectionsGfxRef = useRef<PIXI.Graphics | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const prevNodesJsonRef = useRef<string>('');
  const prevConnsJsonRef = useRef<string>('');

  const [overlayPositions, setOverlayPositions] = useState<Map<string, OverlayPosition>>(new Map());

  const {
    nodes,
    connections,
    updateNodePosition,
    addConnection,
    selectNode,
    executeAll,
  } = useCanvasStore();

  const { syncNodes, syncConnections: syncCollabConnections, isConnected } = useCollabStore();
  const { showRecommendations } = useSettingsStore();

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
      // 记录节点使用（用于推荐引擎）
      if (nodeId) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) recordNodeUsage(node.type);
      }
    },
    [selectNode, nodes]
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

    // 创建 Overlay 管理器
    const om = new OverlayManager(cm);
    overlayManagerRef.current = om;

    // 创建节点容器
    const nodesContainer = new PIXI.Container();
    nodesContainer.name = '__nodes__';
    cm.worldContainer.addChild(nodesContainer);
    nodesContainerRef.current = nodesContainer;

    // 创建小地图
    const rect = containerRef.current.getBoundingClientRect();
    const minimap = new MinimapRenderer(cm.app.stage, rect.width, rect.height);
    minimapRef.current = minimap;

    // 渲染循环
    const ticker = () => {
      im.update();
      syncConnections();

      // 更新 Overlay 位置
      const currentNodes = useCanvasStore.getState().nodes;
      om.updatePositions(currentNodes);

      // 更新小地图
      const currentConns = useCanvasStore.getState().connections;
      minimap.update(currentNodes, currentConns, cm.viewport, rect.width, rect.height);
    };
    cm.app.ticker.add(ticker);

    // 响应式缩放
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        cm.resize(width, height);
        minimap.reposition(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cm.app.ticker.remove(ticker);
      resizeObserver.disconnect();
      im.setRenderedNodes(new Map());
      om.destroy();
      minimap.destroy();
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

    // 同步到协作层
    if (isConnected) {
      syncNodes(nodes);
    }
  }, [nodes, isConnected, syncNodes]);

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

    // 同步到协作层
    if (isConnected) {
      syncCollabConnections(connections);
    }
  }, [connections, isConnected, syncCollabConnections]);

  useEffect(() => {
    prevConnsJsonRef.current = ''; // force re-render
    syncConnections();
  }, [connections, syncConnections]);

  // 更新 overlay 位置状态（每帧由 ticker 更新，这里定期读取）
  useEffect(() => {
    const interval = setInterval(() => {
      const om = overlayManagerRef.current;
      if (om) {
        setOverlayPositions(om.getPositions());
      }
    }, 50); // 20fps 更新 overlay 位置
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* PixiJS 画布 */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />

      {/* HTML Overlay 层 - 多模态输出 */}
      {nodes.map((node) => {
        if (!isOutputNode(node.type)) return null;
        const pos = overlayPositions.get(node.id);
        if (!pos) return null;

        return (
          <OutputRenderer
            key={node.id}
            node={node}
            screenX={pos.screenX}
            screenY={pos.screenY}
            visible={pos.visible}
          />
        );
      })}

      {/* 智能推荐面板 */}
      {showRecommendations && <RecommendationPanel />}
    </div>
  );
};

export default Canvas;
