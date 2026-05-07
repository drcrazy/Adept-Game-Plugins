/**
 * @adept/plugin-sdk — apiVersion 1
 *
 * Canonical shared types for the Adept show platform.
 * Adept-Game provides runtime implementations; plugins import only from here.
 */

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

export type RoundIndex = 1 | 2 | 3;

export type Phase =
  | { kind: "lobby" }
  | { kind: "spectator_picks" }
  | { kind: "round"; roundIndex: RoundIndex }
  | { kind: "mini_wheel"; roundIndex: RoundIndex }
  | { kind: "mini_roulette"; roundIndex: RoundIndex }
  | { kind: "story_video" }
  | { kind: "donations" }
  | { kind: "between_final" }
  | { kind: "final" }
  | { kind: "game_over" }
  /** Opaque segment injected by a plugin between anchor rounds. */
  | { kind: "plugin_segment"; id: string; pluginId: string };

export function phaseKey(p: Phase): string {
  switch (p.kind) {
    case "lobby":
    case "spectator_picks":
    case "story_video":
    case "donations":
    case "between_final":
    case "final":
    case "game_over":
      return p.kind;
    case "round":
    case "mini_wheel":
    case "mini_roulette":
      return `${p.kind}:${p.roundIndex}`;
    case "plugin_segment":
      return `plugin_segment:${p.pluginId}:${p.id}`;
  }
}

// ---------------------------------------------------------------------------
// Session snapshot (mirrors backend/src/session.ts SessionSnapshot)
// ---------------------------------------------------------------------------

export type Role = "host" | "player" | "spectator";

export type Scores = [number, number, number, number, number];

export type ChatLine = {
  id: string;
  atMs: number;
  fromDisplayName: string;
  fromRole: Role;
  text: string;
};

export type Participant = {
  id: string;
  displayName: string;
  role: Role;
};

export type QuestionCell = {
  text: string;
  questionUrl: string;
  answerText: string;
  answerUrl: string;
  /** Identifies the card handler; standard quiz cell when absent. */
  cardKind?: string;
  /** Handler-specific parameters for non-standard card kinds. */
  cardParams?: unknown;
  splashUrl?: string;
  splashVariant?: "spiral" | "dedFly";
  splashAudioUrl?: string;
  splashDismissHostOnly?: boolean;
  headerUrl?: string;
  headerCornerUrl?: string;
};

export type RoundBoardRuntime = {
  themes: string[];
  questions: QuestionCell[][];
  revealed: boolean[][];
  pointValues: number[][];
};

export type SessionSnapshot = {
  showId: string;
  version: number;
  phase: Phase;
  scores: Scores;
  currentTurnSeat: number;
  roundBoard: Record<RoundIndex, RoundBoardRuntime>;
  finalTransitionBoard: RoundBoardRuntime;
  miniWheelPlaysByRound: [number, number, number];
  miniRoulettePlaysByRound: [number, number, number];
  /**
   * Generic per-segment state, written only by the owning plugin's server handler.
   * Keyed by segmentId. Untouched by the core session service.
   */
  segmentState: Record<string, unknown>;
  openingShow: { emojiLineIndex: number; spectatorCorrectCounts: Record<string, number> };
  spectatorPicks: { locked: boolean; bets: Record<string, 1 | 2 | 3 | 4 | 5> };
  donations: { bySeat: [number | null, number | null, number | null, number | null, number | null] };
  lottery: { candidates: string[]; optOut: Record<string, true>; lastWinnerNick: string | null };
  chat: ChatLine[];
  participants: Participant[];
};

// ---------------------------------------------------------------------------
// Plugin context handed to server-side action handlers
// ---------------------------------------------------------------------------

export type MutatorResult = { ok: true } | { ok: false; error: string };

/**
 * Narrow authority surface for plugin server handlers.
 * Plugins must not write to snapshot fields directly outside `segmentState`.
 */
export type Ctx = {
  readonly snapshot: SessionSnapshot;
  requestTransition(to: Phase): MutatorResult;
  setSegmentState(key: string, value: unknown): void;
};

// ---------------------------------------------------------------------------
// Plugin manifest (`adept` field in plugin package.json)
// ---------------------------------------------------------------------------

export type SegmentCapability = {
  /** Segment id — becomes the `id` field in `{ kind: "plugin_segment", id, pluginId }`. */
  id: string;
  /** Slot declaration, e.g. `"after:round:2"`. Validator rejects undeclared slots. */
  slot: string;
  /** Phase key of the following anchor, e.g. `"round:3"`. */
  next: string;
};

export type PluginManifest = {
  pluginId: string;
  apiVersion: number;
  capabilities: {
    segments?: SegmentCapability[];
    cardKinds?: string[];
  };
};

// ---------------------------------------------------------------------------
// Server-side plugin registry API (implemented by Adept-Game host)
// ---------------------------------------------------------------------------

export type SegmentActionHandler = (
  action: string,
  payload: unknown,
  ctx: Ctx,
) => MutatorResult;

export type SegmentDefinition = {
  pluginId: string;
  /** Matches `SegmentCapability.id` from the manifest. */
  id: string;
  /** Phase key of the preceding anchor, e.g. `"round:2"`. */
  fromPhaseKey: string;
  /** Phase key of the following anchor, e.g. `"round:3"`. */
  toPhaseKey: string;
  onAction?: SegmentActionHandler;
};

export type CardHandlerDef = {
  pluginId: string;
  cardKind: string;
};

export interface PluginServerRegistry {
  registerSegment(def: SegmentDefinition): void;
  registerCardHandler(def: CardHandlerDef): void;
}

// ---------------------------------------------------------------------------
// Client-side plugin registry API (implemented by Adept-Game host)
// ---------------------------------------------------------------------------

export type SegmentViewProps = {
  snapshot: SessionSnapshot;
  segmentId: string;
  pluginId: string;
  sendAction(action: string, payload?: unknown): void;
};

export type CardExtensionProps = {
  snapshot: SessionSnapshot;
  cardKind: string;
  cardParams: unknown;
  revealed: boolean;
};

export interface PluginClientRegistry {
  /**
   * Register a React component that renders inside `<PluginSegmentHost />`.
   * Typed as `unknown` so the SDK carries no React peer-dep; host casts to ComponentType.
   */
  registerSegmentView(pluginId: string, segmentId: string, component: unknown): void;
  registerCardExtension(cardKind: string, component: unknown): void;
}

// ---------------------------------------------------------------------------
// WS protocol additions (client → server)
// ---------------------------------------------------------------------------

export type PluginActionMessage = {
  type: "plugin_action";
  payload: {
    pluginId: string;
    segmentId: string;
    action: string;
    payload: unknown;
  };
};
