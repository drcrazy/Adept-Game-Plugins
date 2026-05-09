/**
 * @adept-plugins/opening-show — client entry point
 *
 * Registers a React segment view for opening_show.
 * Host can advance emoji line, mark spectator answers, and start spectator bets.
 */

import { useMemo, useState } from 'react'
import type {
  Participant,
  PluginClientRegistry,
  Role,
  SegmentViewProps,
  SessionSnapshot,
} from '@adept/plugin-sdk'
import type { OpeningShowState } from './state.js'

const PLUGIN_ID = 'opening-show'
const SEGMENT_ID = 'opening_show'

const LOBBY_EMOJI_REVEAL_LINES: readonly string[] = [
  '🫵❌✔️',
  '❄️🧙‍♂️💀🐈‍⬛',
  '🗡🧊👑',
  '🐉 ◼️🧍‍♀️',
  '🐉 🔵 🪄',
  '🧙‍♂️🗡🏹🛡🔪🔨3🧍‍♂️1🧍‍♀️',
  '👨‍🏫2💧🟠🟢',
  '🌌💫🕳',
  '🔥🔨👍',
  '🐕🔥😱',
  '🧟‍♂️⚡️',
  '🎣⛲️💦',
  '🐠👩‍🦱🐍🏹',
  '🤖🚮',
  '🐉🟣➖',
  '💧🚦',
  '🐥🔥🌪',
  '🦂🐅',
  '🕷🕸',
  '🕷🔥',
  '🦵🌋🔥',
  '🪲🥶👑',
  '🐉🧊🥶',
  '🧙‍♂️🤒🪩🕺💃',
  '🍄‍🟫🦠',
  '🪱🔥',
  '👸🩸🦇',
  '💨🌪⚡️',
  '🧊⚡️',
  '🐉◼️🤵‍♂️🔮',
  '🐉◼️🤵‍♂️🔥',
  '🟦🟩🟥🟪 4🐕',
  '🛁❤️',
  '👑👻',
  '🐂💩🪜',
  '🐉🌌⚡️',
  '🐉🌚🌝',
  '🪨💥✈️',
  '🔥💣💥',
  '👩‍🦳💦🙈',
] as const

const LOBBY_EMOJI_REVEAL_LINE_COUNT = LOBBY_EMOJI_REVEAL_LINES.length

function participantRoleLabel(role: Participant['role']): string {
  switch (role) {
    case 'host':
      return 'Ведущий'
    case 'player':
      return 'Игрок'
    case 'spectator':
      return 'Зритель'
    default:
      return String(role)
  }
}

function getState(snapshot: SessionSnapshot): OpeningShowState {
  return (snapshot.segmentState[SEGMENT_ID] ?? {
    emojiLineIndex: -1,
    spectatorCorrectCounts: {},
  }) as OpeningShowState
}

export function OpeningShowHostAside({
  snapshot,
  pluginId,
  segmentId,
  role,
  send,
}: {
  snapshot: SessionSnapshot
  pluginId: string
  segmentId: string
  role: Role
  send(type: string, payload: unknown): void
}) {
  if (role !== 'host') return null

  const state = getState(snapshot)
  const [draftCorrectByParticipantId, setDraftCorrectByParticipantId] = useState<
    Record<string, string>
  >({})

  const lineIdx = state.emojiLineIndex
  const emojiAllShown = lineIdx >= LOBBY_EMOJI_REVEAL_LINE_COUNT - 1
  const emojiAtStart = lineIdx < 0

  const onlineUsersSorted = useMemo(() => {
    const counts = state.spectatorCorrectCounts
    const onlineIds = new Set(snapshot.onlineParticipantIds ?? [])
    return snapshot.participants
      .filter(p => onlineIds.has(p.id))
      .slice()
      .sort((a, b) => {
        const ca = counts[a.displayName] ?? 0
        const cb = counts[b.displayName] ?? 0
        if (cb !== ca) return cb - ca
        return a.displayName.localeCompare(b.displayName)
      })
  }, [
    snapshot.participants,
    snapshot.onlineParticipantIds,
    state.spectatorCorrectCounts,
  ])

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 0,
        background: '#1c1f28',
        border: '1px solid #2a3142',
        borderRadius: '10px',
      }}>
      <div
        style={{
          flexShrink: 0,
          padding: '0.625rem 1rem',
          borderBottom: '1px solid rgba(42, 49, 66, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
        <button
          type="button"
          disabled={emojiAtStart}
          onClick={() =>
            send('plugin_event', { pluginId, segmentId, event: 'prev_emoji', payload: null })
          }
          className="game-header__phase-nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span>
          Emoji: {lineIdx + 1} / {LOBBY_EMOJI_REVEAL_LINE_COUNT}
        </span>

        <button
          type="button"
          disabled={emojiAllShown}
          onClick={() =>
            send('plugin_event', { pluginId, segmentId, event: 'next_emoji', payload: null })
          }
          className="game-header__phase-nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div style={{ flexShrink: 0, padding: '0.625rem 1rem', borderBottom: '1px solid rgba(42, 49, 66, 0.55)' }}>
        <button
          type="button"
          onClick={() => send('plugin_event', { pluginId, segmentId, event: 'top5_start_bets', payload: null })}
          className="game-header__phase-nav-btn"
          style={{ width: '100%' }}>
          Дальше 
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            border: '1px solid rgba(42, 49, 66, 0.9)',
            background: '#0f1320',
          }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(42, 49, 66, 0.95)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 8px',
                    color: '#9aa3b2',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    background: '#0f1320',
                  }}>
                  Имя
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 8px',
                    color: '#9aa3b2',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    background: '#0f1320',
                  }}>
                  Роль
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '8px 8px',
                    color: '#9aa3b2',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    background: '#0f1320',
                  }}>
                  Позиция
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '8px 10px 8px 6px',
                    color: '#9aa3b2',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    background: '#0f1320',
                  }}>
                  
                </th>
              </tr>
            </thead>
            <tbody>
              {onlineUsersSorted.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '14px 10px', color: '#9aa3b2' }}>
                    No users online.
                  </td>
                </tr>
              ) : (
                onlineUsersSorted.map(p => {
                  const serverCount = state.spectatorCorrectCounts[p.displayName] ?? 0
                  const draft = draftCorrectByParticipantId[p.id]
                  const inputValue = draft !== undefined ? draft : String(serverCount)

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(42, 49, 66, 0.55)' }}>
                      <td style={{ padding: '8px 10px', color: '#e8eef6', verticalAlign: 'middle' }}>
                        {p.displayName}
                      </td>
                      <td style={{ padding: '8px 8px', color: '#9aa3b2', verticalAlign: 'middle' }}>
                        {participantRoleLabel(p.role)}
                      </td>
                      <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValue}
                          onChange={e =>
                            setDraftCorrectByParticipantId(s => ({ ...s, [p.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const raw = draftCorrectByParticipantId[p.id]
                            if (raw === undefined) return
                            let n = Number.parseInt(raw.trim(), 10)
                            if (!Number.isFinite(n) || n < 0) n = serverCount
                            n = Math.min(9999, Math.floor(n))
                            send('plugin_event', {
                              pluginId,
                              segmentId,
                              event: 'set_correct_count',
                              payload: { spectatorKey: p.displayName, count: n },
                            })
                            setDraftCorrectByParticipantId(s => {
                              const next = { ...s }
                              delete next[p.id]
                              return next
                            })
                          }}
                          style={{
                            width: 52,
                            maxWidth: '100%',
                            padding: '6px 8px',
                            textAlign: 'right',
                            boxSizing: 'border-box',
                            background: '#1a2130',
                            border: '1px solid #2a3142',
                            borderRadius: 8,
                            color: '#fff',
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            send('plugin_event', {
                              pluginId,
                              segmentId,
                              event: 'mark_correct',
                              payload: { spectatorKey: p.displayName },
                            })
                            setDraftCorrectByParticipantId(s => {
                              const next = { ...s }
                              delete next[p.id]
                              return next
                            })
                          }}
                          className="game-header__phase-nav-btn">
                          +1
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

function OpeningShowView({ snapshot }: SegmentViewProps) {
  const state = getState(snapshot)
  const lineIdx = state.emojiLineIndex
  const emojiLobbyText =
    lineIdx >= 0 && lineIdx < LOBBY_EMOJI_REVEAL_LINE_COUNT
      ? (LOBBY_EMOJI_REVEAL_LINES[lineIdx] ?? '')
      : ''

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
      <div
        style={{
          width: '100%',
          maxWidth: 980,
          padding: 16,
          background: 'transparent',
          borderRadius: 10,
          boxSizing: 'border-box',
        }}>
        <div
          style={{
            borderRadius: 18,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            boxShadow:
              '0 0 20px rgba(234,179,8,0.22), 0 0 48px rgba(250,204,21,0.12), inset 0 0 24px rgba(234,179,8,0.06)',
            padding: 18,
            minHeight: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            background: 'transparent',
            fontFamily:
              'Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif',
          }}>
          {emojiLobbyText ? (
            <div
              style={{
                width: '100%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.2,
                letterSpacing: '0.02em',
                fontSize: 'clamp(2rem, min(9vmin, 10vw), 5.25rem)',
                wordSpacing: '0.12em',
              }}>
              {emojiLobbyText}
            </div>
          ) : (
            <div style={{ maxWidth: 520, color: '#9aa3b2', lineHeight: 1.5 }}>
              Здесь появятся эмодзи, твоя задача разгадать, какой босс зашифрован, ответ пиши в чат.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function registerClient(registry: PluginClientRegistry): void {
  registry.registerSegmentView(PLUGIN_ID, SEGMENT_ID, OpeningShowView)
  registry.registerSegmentRailView(PLUGIN_ID, SEGMENT_ID, OpeningShowHostAside)
}
