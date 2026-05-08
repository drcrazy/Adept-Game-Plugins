/**
 * @adept/plugin-sdk — apiVersion 1
 *
 * Canonical shared types for the Adept show platform.
 * Adept-Game provides runtime implementations; plugins import only from here.
 *
 * Main anchor phases: lobby  →  round:1 → round:2 → round:3  →  final
 * Everything else (spectator_bet, story_video, donations, between_final, wheel,
 * roulette …) is a transition plugin_segment or a card-kind handler.
 * `final` is terminal — there is no separate "game over" state.
 */

// ---------------------------------------------------------------------------
// Phase — anchor phases + opaque plugin segments
// ---------------------------------------------------------------------------

export type RoundIndex = 1 | 2 | 3;

export type Phase =
  | { kind: "lobby" }
  | { kind: "round"; roundIndex: RoundIndex }
  | { kind: "final" }
  /** Opaque segment registered by a plugin (first-party or third-party). */
  | { kind: "plugin_segment"; id: string; pluginId: string };

export function phaseKey(p: Phase): string {
  switch (p.kind) {
    case "lobby":
    case "final":
      return p.kind;
    case "round":
      return `round:${p.roundIndex}`;
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

/**
 * Identity of the socket actor triggering a plugin event.
 * Note: seat identity (if any) is host-defined and not modeled here.
 */
export type Actor = {
  participantId: string;
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
  /**
   * All plugin-managed state lives here, keyed by a stable string the plugin
   * owns (e.g. `"spectator_picks"`, `"donations"`, `"wheel_r1"`).
   * The core session service never reads or writes this object.
   */
  segmentState: Record<string, unknown>;
  lottery: { candidates: string[]; optOut: Record<string, true>; lastWinnerNick: string | null };
  chat: ChatLine[];
  participants: Participant[];
  /** Participant ids currently connected (at least one open socket per id). */
  onlineParticipantIds: string[];
};

// ---------------------------------------------------------------------------
// Plugin context handed to server-side action handlers
// ---------------------------------------------------------------------------

export type MutatorResult = { ok: true } | { ok: false; error: string };

/**
 * Narrow authority surface for plugin server handlers.
 * Use `setSegmentState` for persistent data; `requestTransition` for phase changes.
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

export type SegmentEventHandler = (
  event: string,
  payload: unknown,
  actor: Actor,
  ctx: Ctx,
) => MutatorResult;

export type SegmentDefinition = {
  pluginId: string;
  id: string;
  fromPhaseKey: string;
  toPhaseKey: string;
  onAction?: SegmentActionHandler;
  onEvent?: SegmentEventHandler;
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
  /** Send any WS message (e.g. `spectator_pick_bet`, `plugin_action`). */
  send(type: string, payload: unknown): void;
};

export type CardExtensionProps = {
  snapshot: SessionSnapshot;
  cardKind: string;
  cardParams: unknown;
  revealed: boolean;
};

export interface PluginClientRegistry {
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

export type PluginEventMessage = {
  type: "plugin_event";
  payload: {
    pluginId: string;
    segmentId: string;
    event: string;
    payload: unknown;
  };
};
