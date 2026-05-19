/**
 * @adept/plugin-sdk — apiVersion 2
 *
 * Canonical shared types for the Adept show platform.
 * Adept-Game provides runtime implementations; plugins import only from here.
 *
 * Main anchor phases: lobby  →  round:1 → round:2 → round:3  →  final
 * Everything else is either a transition `plugin_segment` (between anchors) or
 * a `cardKind` attached to a question cell (rendered inside a round; phase
 * stays `round:N` while the card is open).
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
  /**
   * Normalized list of card-plugin kinds attached to this cell. The host loader
   * also accepts the legacy single-string form `cardKind: "x"` in JSON and
   * normalizes it to `cardKinds: ["x"]` at parse time.
   */
  cardKinds?: string[];
  /**
   * Per-kind handler parameters, keyed by `cardKind`. Each plugin owns its own
   * bucket; the loader normalizes the legacy single-object form when only one
   * kind is declared.
   */
  cardParams?: Record<string, unknown>;
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

/**
 * Server-authoritative descriptor of the currently-open question card, or
 * `null` when no card is open. The card layer is orthogonal to `phase`: while
 * `activeCard` is non-null, `phase` remains the round phase the card was
 * opened from.
 */
export type ActiveCard = {
  board: "round" | "finalTransition";
  roundIndex?: RoundIndex;
  rowIndex: number;
  colIndex: number;
  stage: "question" | "answer";
  /** Kinds resolved at open-time from the cell's normalized `cardKinds`. */
  cardKinds: string[];
  /** Per-kind ephemeral state owned by each plugin. Cleared on close. */
  pluginState: Record<string, unknown>;
};

/**
 * Manifest entry that lets the host's edit UI discover what cardKinds the
 * server knows about. Immutable per process; populated at boot.
 */
export type RegisteredCardKind = {
  pluginId: string;
  cardKind: string;
  mode: CardMode;
  /** True when the kind reads `cardParams` from JSON; UI shows the editor only then. */
  hasParams: boolean;
};

export type SessionSnapshot = {
  showId: string;
  version: number;
  phase: Phase;
  /** Display names for quiz seats 1–5 (indices 0–4). Host-editable. */
  seatNames: [string, string, string, string, string];
  scores: Scores;
  currentTurnSeat: number;
  roundBoard: Record<RoundIndex, RoundBoardRuntime>;
  finalTransitionBoard: RoundBoardRuntime;
  /** Currently-open card overlay, or `null`. Orthogonal to `phase`. */
  activeCard: ActiveCard | null;
  /** Plugin-discovery manifest. */
  registeredCardKinds: RegisteredCardKind[];
  /**
   * All plugin-managed state lives here, keyed by a stable string the plugin
   * owns (e.g. `"spectator_picks"`, `"donations"`).
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
 * Narrow authority surface for segment plugin server handlers.
 * Use `setSegmentState` for persistent data; `requestTransition` for phase changes.
 */
export type Ctx = {
  readonly snapshot: SessionSnapshot;
  requestTransition(to: Phase): MutatorResult;
  setSegmentState(key: string, value: unknown): void;
};

// ---------------------------------------------------------------------------
// Card-plugin types
// ---------------------------------------------------------------------------

export type CardMode = "in_card" | "replace_card" | "replace_field";

/** Target descriptor for `openCellInstead`. */
export type CardCellTarget = {
  boardKind: "round" | "finalTransition";
  roundIndex?: RoundIndex;
  rowIndex: number;
  colIndex: number;
};

/**
 * Narrow authority surface for card-plugin handlers. Each call is scoped to a
 * single `cardKind`; `cardParams` / `pluginState` come from that kind's bucket.
 */
export type CardCtx = {
  readonly snapshot: SessionSnapshot;
  /** This kind's pre-validated `cardParams`. */
  readonly cardParams: unknown;
  /** This kind's bucket in `activeCard.pluginState`. */
  readonly pluginState: unknown;
  /** Replace this kind's bucket. No other kinds are touched. */
  setPluginState(value: unknown): void;
  /** Move the open card from `question` to `answer`. */
  advanceCardStage(to: "answer"): MutatorResult;
  /** Close the open card. `revealed` flips the board's revealed flag. */
  closeCard(outcome: "revealed" | "cancelled"): MutatorResult;
  /** Close the open card and open a different cell. Stage is reset. */
  openCellInstead(target: CardCellTarget): MutatorResult;
  /** Convenience: returns `{ ok: false, error }` when actor isn't a host. */
  requireHost(actor: Actor): MutatorResult;
};

export type CardOpenHandler = (ctx: CardCtx) => MutatorResult;
export type CardAdvanceHandler = (to: "answer", ctx: CardCtx) => MutatorResult;
export type CardCloseHandler = (
  outcome: "revealed" | "cancelled",
  ctx: CardCtx,
) => MutatorResult;
export type CardEventHandler = (
  event: string,
  payload: unknown,
  actor: Actor,
  ctx: CardCtx,
) => MutatorResult;

/**
 * Per-kind parameter validator. Called at pack load and `host_edit_quiz_question`.
 * If a plugin omits `validateParams` the loader passes `raw` through unchanged.
 */
export type CardParamsValidator = (raw: unknown) => MutatorResult | { ok: true; value: unknown };

export type CardKindDefinition = {
  pluginId: string;
  cardKind: string;
  mode: CardMode;
  validateParams?: CardParamsValidator;
  onOpen?: CardOpenHandler;
  onAdvance?: CardAdvanceHandler;
  onClose?: CardCloseHandler;
  onCardEvent?: CardEventHandler;
};

// ---------------------------------------------------------------------------
// Plugin manifest (`adept` field in plugin package.json)
// ---------------------------------------------------------------------------

export type SegmentCapability = {
  id: string;
  slot: string;
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

export interface PluginServerRegistry {
  registerSegment(def: SegmentDefinition): void;
  registerCardKind(def: CardKindDefinition): void;
}

// ---------------------------------------------------------------------------
// Client-side plugin registry API (implemented by Adept-Game host)
// ---------------------------------------------------------------------------

export type SegmentViewProps = {
  snapshot: SessionSnapshot;
  segmentId: string;
  pluginId: string;
  role: Role;
  /** Same id as WebSocket `join`; aligns with server maps keyed by participant id. */
  participantId: string;
  /** Send any WS message (e.g. `plugin_event`, `plugin_card_event`). */
  send(type: string, payload: unknown): void;
};

/** Props for plugin-provided card components rendered while a card is open. */
export type CardActionProps = {
  snapshot: SessionSnapshot;
  activeCard: ActiveCard;
  /** This kind's `cardKind` string. */
  cardKind: string;
  /** This kind's pre-validated `cardParams`. */
  cardParams: unknown;
  /** This kind's bucket in `activeCard.pluginState`. */
  pluginState: unknown;
  role: Role;
  participantId: string;
  /** Convenience: emits `plugin_card_event` for this cardKind. */
  send(event: string, payload: unknown): void;
};

export type CardModalProps = CardActionProps & {
  themeName: string;
  pointValue: number;
  cell: QuestionCell;
  /** Session WebSocket intents (`lottery_*`, etc.), not scoped to `plugin_card_event`. */
  wsSend(type: string, payload: unknown): void;
};

export type CardFullScreenProps = CardModalProps;

/** Props for the host-side edit UI param editor. */
export type CardParamsEditorProps = {
  value: unknown;
  onChange(next: unknown): void;
  role: "host";
};

export type CardKindClientDef = {
  /** Human-readable name shown in the host's cardKinds picker. */
  label: string;
  description?: string;
  /** Returned when the host first selects this kind in the editor. */
  defaultParams?: () => unknown;
  /** Plugin-supplied editor for `cardParams[cardKind]`. Falls back to a JSON textarea when absent. */
  ParamsEditor?: unknown;
  /** Mode `in_card` slot rendered before the answer is revealed. */
  PreRevealAction?: unknown;
  /** Mode `in_card` slot rendered after the answer is revealed. */
  PostRevealAction?: unknown;
  /** Mode `replace_card`: replaces the standard modal body. */
  ModalView?: unknown;
  /** Mode `replace_field`: replaces the main quiz column while the card is open. */
  FullScreenView?: unknown;
  /** Host-only buttons rendered in the question modal footer row (answer stage). */
  HostAnswerFooterAction?: unknown;
};

export interface PluginClientRegistry {
  registerSegmentView(pluginId: string, segmentId: string, component: unknown): void;
  /** Optional segment slot rendered in the host right rail column. */
  registerSegmentRailView(pluginId: string, segmentId: string, component: unknown): void;
  /** Optional segment slot that replaces the entire host page UI. */
  registerSegmentFullScreenView(pluginId: string, segmentId: string, component: unknown): void;
  /** Card-plugin registration with per-kind UI metadata and component slots. */
  registerCardKindClient(cardKind: string, def: CardKindClientDef): void;
}

// ---------------------------------------------------------------------------
// WS protocol additions (client → server)
// ---------------------------------------------------------------------------

export type PluginEventMessage = {
  type: "plugin_event";
  payload: {
    pluginId: string;
    segmentId: string;
    event: string;
    payload: unknown;
  };
};

/**
 * Card-scoped plugin event. Routed to the open card's matching `cardKind`
 * `onCardEvent` handler. The server hard-guards that `snapshot.activeCard` is
 * non-null and its `cardKinds[]` contains the requested `cardKind`.
 */
export type PluginCardEventMessage = {
  type: "plugin_card_event";
  payload: {
    cardKind: string;
    event: string;
    payload: unknown;
  };
};

/**
 * Open a question card (host or current-turn player). The server resolves the
 * cell's normalized `cardKinds`, runs each kind's `onOpen`, and sets
 * `snapshot.activeCard`.
 */
export type OpenQuizCellMessage = {
  type: "open_quiz_cell";
  payload: {
    boardKind: "round" | "finalTransition";
    roundIndex?: RoundIndex;
    rowIndex: number;
    colIndex: number;
  };
};

/** Host-only: move `activeCard.stage` from `question` to `answer`. */
export type HostAdvanceCardStageMessage = {
  type: "host_advance_card_stage";
  payload: { to: "answer" };
};

/**
 * Host-only: close the active card. `revealed` also flips the board's
 * `revealed[row][col]`. Runs each kind's `onClose`.
 */
export type HostCloseQuizCellMessage = {
  type: "host_close_quiz_cell";
  payload: { outcome: "revealed" | "cancelled" };
};
