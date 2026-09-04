/**
 * Room WebSocket + host-authoritative WebRTC datachannel.
 * Same compact messages on the channel; WS relay if ICE never opens.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import {
  iceServersFromEnv,
  isPlayNetMessage,
  PLAY_ICE_TIMEOUT_MS,
  type PlayNetMessage,
  type PlayTransport,
  type SignalPayload,
} from "@/components/Playtester/net/playNet.logic"
import type { PlayerSlot } from "@/components/Playtester/constants"
import { useLatestRef } from "@/hooks/useLatestRef"
import { createPlayRoom, playWsUrl } from "@/lib/api/playRooms"
import { safeJsonParse } from "@/lib/utils"

export type PlayNetStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "disconnected"

export type UsePlayNetArgs = {
  token: string | null
  localDeckId: number
}

export function usePlayNet({ token, localDeckId }: UsePlayNetArgs) {
  const [code, setCode] = useState<string | null>(null)
  const [status, setStatus] = useState<PlayNetStatus>("idle")
  const [transport, setTransport] = useState<PlayTransport>("connecting")
  const [seat, setSeat] = useState<PlayerSlot | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [peerDeckId, setPeerDeckId] = useState<number | null>(null)
  const [peerPresent, setPeerPresent] = useState(false)
  /**
   * Sticky once the other seat has been filled. Deck fetches send this as
   * `?room=` to pool preview/unpublished access across both players; keeping it
   * set through a dropped peer avoids re-redacting cards mid-game.
   */
  const [peerSeated, setPeerSeated] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  /** Bumped on every connect attempt so a superseded socket's onclose is ignored. */
  const connectGenRef = useRef(0)
  const joiningRef = useRef(false)
  /** After Leave room — block URL auto-join until the user creates/joins again. */
  const blockAutoJoinRef = useRef(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const iceTimerRef = useRef<number | null>(null)
  const handlersRef = useRef<{
    onIntent?: (action: PlayNetMessage & { type: "intent" }) => void
    onFog?: (view: Extract<PlayNetMessage, { type: "fog" }>["view"]) => void
    onSnapshot?: () => void
    onHover?: (msg: Extract<PlayNetMessage, { type: "hover" }>) => void
    onSelection?: (msg: Extract<PlayNetMessage, { type: "selection" }>) => void
    onEvent?: (action: Extract<PlayNetMessage, { type: "event" }>["action"]) => void
    onFx?: (fx: Extract<PlayNetMessage, { type: "fx" }>["fx"]) => void
  }>({})

  const tokenRef = useLatestRef(token)
  const deckIdRef = useLatestRef(localDeckId)
  const isHostRef = useLatestRef(isHost)
  const codeRef = useLatestRef(code)

  const sendWs = useCallback((msg: PlayNetMessage) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(msg))
  }, [])

  const send = useCallback(
    (msg: PlayNetMessage) => {
      const dc = dcRef.current
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify(msg))
        return
      }
      sendWs(msg)
    },
    [sendWs]
  )

  const handleGameMessage = useCallback((raw: unknown) => {
    if (!isPlayNetMessage(raw)) return
    if (raw.type === "intent") {
      handlersRef.current.onIntent?.(raw)
      return
    }
    if (raw.type === "fog") {
      handlersRef.current.onFog?.(raw.view)
      return
    }
    if (raw.type === "snapshot") {
      handlersRef.current.onSnapshot?.()
      return
    }
    if (raw.type === "hover") {
      handlersRef.current.onHover?.(raw)
      return
    }
    if (raw.type === "selection") {
      handlersRef.current.onSelection?.(raw)
      return
    }
    if (raw.type === "event") {
      handlersRef.current.onEvent?.(raw.action)
      return
    }
    if (raw.type === "fx") {
      handlersRef.current.onFx?.(raw.fx)
    }
  }, [])

  const bindDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dcRef.current = dc
      dc.onopen = () => {
        setTransport("p2p")
        if (iceTimerRef.current != null) {
          window.clearTimeout(iceTimerRef.current)
          iceTimerRef.current = null
        }
      }
      dc.onclose = () => {
        if (dcRef.current === dc) {
          dcRef.current = null
          setTransport((prev) => (prev === "p2p" ? "relay" : prev))
        }
      }
      dc.onmessage = (event) => {
        const raw = safeJsonParse(String(event.data))
        if (raw == null) return
        handleGameMessage(raw)
      }
    },
    [handleGameMessage]
  )

  const closePeer = useCallback(() => {
    if (iceTimerRef.current != null) {
      window.clearTimeout(iceTimerRef.current)
      iceTimerRef.current = null
    }
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    iceQueueRef.current = []
    remoteSetRef.current = false
  }, [])

  const startIceTimer = useCallback(() => {
    if (iceTimerRef.current != null) window.clearTimeout(iceTimerRef.current)
    iceTimerRef.current = window.setTimeout(() => {
      iceTimerRef.current = null
      if (dcRef.current?.readyState !== "open") {
        setTransport("relay")
      }
    }, PLAY_ICE_TIMEOUT_MS)
  }, [])

  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current
    const pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() })
    pcRef.current = pc
    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      sendWs({
        type: "signal",
        payload: { kind: "ice", candidate: event.candidate.toJSON() },
      })
    }
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === "failed" || state === "disconnected") {
        if (dcRef.current?.readyState !== "open") setTransport("relay")
      }
    }
    pc.ondatachannel = (event) => {
      bindDataChannel(event.channel)
    }
    startIceTimer()
    return pc
  }, [bindDataChannel, sendWs, startIceTimer])

  const applySignal = useCallback(
    async (payload: SignalPayload) => {
      const pc = ensurePeer()
      if (payload.kind === "offer") {
        await pc.setRemoteDescription(payload.sdp)
        remoteSetRef.current = true
        for (const c of iceQueueRef.current) {
          await pc.addIceCandidate(c)
        }
        iceQueueRef.current = []
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendWs({
          type: "signal",
          payload: { kind: "answer", sdp: pc.localDescription ?? answer },
        })
        return
      }
      if (payload.kind === "answer") {
        await pc.setRemoteDescription(payload.sdp)
        remoteSetRef.current = true
        for (const c of iceQueueRef.current) {
          await pc.addIceCandidate(c)
        }
        iceQueueRef.current = []
        return
      }
      if (!remoteSetRef.current) {
        iceQueueRef.current.push(payload.candidate)
        return
      }
      await pc.addIceCandidate(payload.candidate)
    },
    [ensurePeer, sendWs]
  )

  const startHostOffer = useCallback(async () => {
    const pc = ensurePeer()
    if (dcRef.current) return
    const dc = pc.createDataChannel("play", { ordered: true })
    bindDataChannel(dc)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendWs({
      type: "signal",
      payload: { kind: "offer", sdp: pc.localDescription ?? offer },
    })
  }, [bindDataChannel, ensurePeer, sendWs])

  const connectSocket = useCallback(
    (roomCode: string) => {
      const auth = tokenRef.current
      if (!auth) {
        setErrorText("Sign in to join a room.")
        joiningRef.current = false
        return
      }
      const gen = ++connectGenRef.current
      const prev = wsRef.current
      wsRef.current = null
      prev?.close()
      closePeer()
      setCode(roomCode)
      setStatus("connecting")
      setTransport("connecting")
      setErrorText(null)
      setPeerPresent(false)
      setPeerSeated(false)
      setPeerDeckId(null)

      const ws = new WebSocket(playWsUrl(roomCode, auth))
      wsRef.current = ws

      ws.onopen = () => {
        if (gen !== connectGenRef.current) return
        joiningRef.current = false
        setStatus("waiting")
      }
      ws.onclose = () => {
        if (gen !== connectGenRef.current) return
        if (wsRef.current === ws) {
          wsRef.current = null
          joiningRef.current = false
          setStatus((prevStatus) => {
            if (prevStatus === "idle") return prevStatus
            // Closed before welcome — usually stale seat map / 4409, not mid-game drop.
            if (prevStatus === "connecting") {
              setErrorText("Could not enter room. Leave and create/join again.")
            }
            return "disconnected"
          })
        }
      }
      ws.onerror = () => {
        if (gen !== connectGenRef.current) return
        setErrorText("Room socket failed.")
      }
      ws.onmessage = (event) => {
        if (gen !== connectGenRef.current) return
        const raw: unknown = safeJsonParse(String(event.data))
        if (raw == null) return
        if (!isPlayNetMessage(raw)) return
        if (raw.type === "welcome") {
          if (isHostRef.current) {
            setIsHost(true)
            setSeat("p1")
          } else {
            setSeat(raw.seat)
            setIsHost(raw.host)
          }
          sendWs({ type: "join", deckId: deckIdRef.current })
          if (raw.peer) setPeerSeated(true)
          if (raw.peer?.deckId) {
            const id = Number(raw.peer.deckId)
            if (Number.isFinite(id) && id > 0) setPeerDeckId(id)
          }
          if (raw.peer?.connected) {
            setPeerPresent(true)
            setStatus("connected")
            if (raw.host) {
              void startHostOffer()
            }
          }
          if (!raw.host) {
            send({ type: "snapshot" })
          }
          return
        }
        if (raw.type === "peer-joined") {
          setPeerPresent(true)
          setPeerSeated(true)
          setStatus("connected")
          if (isHostRef.current) {
            void startHostOffer()
          } else {
            closePeer()
            setTransport("connecting")
          }
          return
        }
        if (raw.type === "peer-left") {
          setPeerPresent(false)
          setStatus("waiting")
          closePeer()
          setTransport("connecting")
          return
        }
        if (raw.type === "seat-deck") {
          const id = Number(raw.deckId)
          if (Number.isFinite(id) && id > 0) setPeerDeckId(id)
          setPeerPresent(true)
          setPeerSeated(true)
          setStatus("connected")
          return
        }
        if (raw.type === "signal") {
          void applySignal(raw.payload)
          return
        }
        handleGameMessage(raw)
      }
    },
    [applySignal, closePeer, handleGameMessage, send, sendWs, startHostOffer]
  )

  const createRoom = useCallback(async () => {
    if (!tokenRef.current) {
      setErrorText("Sign in to create a room.")
      return
    }
    if (!Number.isFinite(deckIdRef.current) || deckIdRef.current <= 0) {
      setErrorText("Load a deck first.")
      return
    }
    blockAutoJoinRef.current = false
    isHostRef.current = true
    setIsHost(true)
    setSeat("p1")
    setStatus("connecting")
    try {
      const created = await createPlayRoom(deckIdRef.current, tokenRef.current)
      connectSocket(created.code)
    } catch {
      isHostRef.current = false
      setIsHost(false)
      setSeat(null)
      setStatus("idle")
      setErrorText("Could not create a room.")
    }
  }, [connectSocket])

  const joinRoom = useCallback(
    (roomCode: string) => {
      const trimmed = roomCode.trim().toUpperCase()
      if (trimmed.length < 4) {
        setErrorText("Enter a room code.")
        return
      }
      if (!tokenRef.current) {
        setErrorText("Sign in to join a room.")
        return
      }
      if (joiningRef.current && codeRef.current === trimmed) return
      blockAutoJoinRef.current = false
      joiningRef.current = true
      // Reconnect keeps host flag if this client created the room.
      if (!isHostRef.current) {
        setIsHost(false)
        setSeat("p2")
      }
      connectSocket(trimmed)
    },
    [connectSocket]
  )

  const leaveRoom = useCallback(() => {
    blockAutoJoinRef.current = true
    connectGenRef.current += 1
    joiningRef.current = false
    wsRef.current?.close()
    wsRef.current = null
    closePeer()
    setCode(null)
    setSeat(null)
    setIsHost(false)
    isHostRef.current = false
    setPeerDeckId(null)
    setPeerPresent(false)
    setPeerSeated(false)
    setStatus("idle")
    setTransport("connecting")
    setErrorText(null)
  }, [closePeer])

  /** URL `?room=` auto-join — false after an intentional Leave until create/join. */
  const allowAutoJoin = useCallback(() => !blockAutoJoinRef.current, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      closePeer()
    }
  }, [closePeer])

  const setHandlers = useCallback(
    (handlers: typeof handlersRef.current) => {
      handlersRef.current = handlers
    },
    []
  )

  return {
    code,
    status,
    transport,
    seat,
    isHost,
    peerDeckId,
    peerPresent,
    /** Room code to send with deck fetches, or null when no pooling applies. */
    poolRoom: peerSeated ? code : null,
    errorText,
    createRoom,
    joinRoom,
    leaveRoom,
    allowAutoJoin,
    send,
    setHandlers,
  }
}
