"use client";

import {
  addEdge,
  Background,
  ConnectionLineType,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  FlashIcon,
  GameController02Icon,
  Search01Icon,
  UserGroupIcon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons";
import { useCallback } from "react";

type MatchNodeData = {
  step: string;
  title: string;
  description: string;
  icon: typeof Search01Icon;
  status?: "idle" | "active" | "success";
};

type MatchNode = Node<MatchNodeData, "match">;

const initialNodes: MatchNode[] = [
  {
    id: "choose-game",
    type: "match",
    position: {
      x: 80,
      y: 180,
    },
    data: {
      step: "01",
      title: "Choose a game",
      description: "Pick any public game from the catalogue.",
      icon: Search01Icon,
      status: "idle",
    },
  },
  {
    id: "matchmaking",
    type: "match",
    position: {
      x: 370,
      y: 180,
    },
    data: {
      step: "02",
      title: "Matchmaking",
      description: "The platform looks for another ready player.",
      icon: UserGroupIcon,
      status: "active",
    },
  },
  {
    id: "player-found",
    type: "match",
    position: {
      x: 660,
      y: 180,
    },
    data: {
      step: "03",
      title: "Player found",
      description: "A compatible opponent enters your match.",
      icon: FlashIcon,
      status: "success",
    },
  },
  {
    id: "realtime-match",
    type: "match",
    position: {
      x: 950,
      y: 180,
    },
    data: {
      step: "04",
      title: "Realtime match",
      description: "Both players are synchronized and ready.",
      icon: GameController02Icon,
      status: "idle",
    },
  },
  {
    id: "waiting",
    type: "match",
    position: {
      x: 370,
      y: 390,
    },
    data: {
      step: "02A",
      title: "Still searching",
      description: "No compatible player has joined yet.",
      icon: Clock01Icon,
      status: "idle",
    },
  },
  {
    id: "rematch",
    type: "match",
    position: { x: 600, y: 500 },
    data: {
      step: "05",
      title: "Rematch",
      description: "Start another round with the same player.",
      icon: GameController02Icon,
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "choose-game-matchmaking",
    source: "choose-game",
    target: "matchmaking",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#22d3ee",
      strokeWidth: 1.5,
    },
  },
  {
    id: "matchmaking-player-found",
    source: "matchmaking",
    target: "player-found",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#a78bfa",
      strokeWidth: 1.5,
    },
  },
  {
    id: "player-found-realtime",
    source: "player-found",
    target: "realtime-match",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#34d399",
      strokeWidth: 1.5,
    },
  },
  {
    id: "matchmaking-waiting",
    source: "matchmaking",
    target: "waiting",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#94a3b8",
      strokeWidth: 1,
    },
  },
  {
    id: "waiting-matchmaking",
    source: "waiting",
    target: "matchmaking",
    type: "smoothstep",
    animated: true,
    style: {
      stroke: "#94a3b8",
      strokeWidth: 1,
    },
  },
];

const nodeTypes = {
  match: MatchNodeComponent,
};

export default function MatchWorkflow() {
  const [nodes, , onNodesChange] =
    useNodesState<MatchNode>(initialNodes);

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            style: {
              stroke: "#22d3ee",
              strokeWidth: 1.5,
            },
          },
          currentEdges,
        ),
      );
    },
    [setEdges],
  );

  return (
    <div className="relative h-[560px] w-full overflow-hiddennow">
      <ReactFlow<MatchNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{
          padding: 0.18,
        }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        minZoom={1}
        maxZoom={1}
        proOptions={{
          hideAttribution: true,
        }}
      >
        <Background
          gap={24}
          size={1}
          color="currentColor"
          className="text-slate-200 dark:text-white/[0.045]"
        />
      </ReactFlow>

      {/* Flow status */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-5 text-[11px] text-slate-400 dark:text-white/30">
        <span className="flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute size-full animate-ping rounded-full bg-cyan-400/60" />
            <span className="relative size-1.5 rounded-full bg-cyan-400" />
          </span>
          Processing
        </span>

        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>

        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-slate-400 dark:bg-white/30" />
          Waiting
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 hidden items-center gap-2 text-[11px] text-slate-400 dark:text-white/30 sm:flex">
        <HugeiconsIcon icon={Wifi01Icon} size={13} strokeWidth={1.6} />
        Live connection
      </div>
    </div>
  );
}

function MatchNodeComponent({ data }: NodeProps<MatchNode>) {
  const status = data.status ?? "idle";

  const statusClasses = {
    idle: {
      wrapper:
        "border-slate-200 bg-white dark:border-white/10 dark:bg-[#0a0d12]",
      icon: "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55",
      handle: "bg-slate-400 dark:bg-white/40",
    },

    active: {
      wrapper:
        "border-cyan-300/70 bg-cyan-50/70 dark:border-cyan-400/30 dark:bg-cyan-400/[0.05]",
      icon: "border-cyan-200 bg-cyan-100 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
      handle: "bg-cyan-400",
    },

    success: {
      wrapper:
        "border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-400/30 dark:bg-emerald-400/[0.05]",
      icon: "border-emerald-200 bg-emerald-100 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
      handle: "bg-emerald-400",
    },
  };

  const styles = statusClasses[status];

  return (
    <div
      className={[
        "relative w-[220px] rounded-xl border p-4",
        "transition-colors",
        styles.wrapper,
      ].join(" ")}
    >
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        className={[
          "!h-2.5 !w-2.5 !border-2",
          "!border-slate-50 dark:!border-[#05070b]",
          styles.handle,
        ].join(" ")}
      />

      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className={[
          "!h-2.5 !w-2.5 !border-2",
          "!border-slate-50 dark:!border-[#05070b]",
          styles.handle,
        ].join(" ")}
      />

      <div className="flex items-start gap-3">
        <div
          className={[
            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
            styles.icon,
          ].join(" ")}
        >
          <HugeiconsIcon icon={data.icon} size={18} strokeWidth={1.6} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium tracking-[0.16em] text-slate-400 dark:text-white/25">
              {data.step}
            </span>

            {status === "active" && (
              <span className="relative flex size-1.5">
                <span className="absolute size-full animate-ping rounded-full bg-cyan-400/60" />
                <span className="relative size-1.5 rounded-full bg-cyan-400" />
              </span>
            )}

            {status === "success" && (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={13}
                strokeWidth={1.7}
                className="text-emerald-500"
              />
            )}
          </div>

          <h3 className="mt-1 text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {data.title}
          </h3>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-400 dark:text-white/35">
        {data.description}
      </p>
    </div>
  );
}
