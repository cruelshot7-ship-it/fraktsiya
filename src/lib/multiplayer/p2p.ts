/** Temporary stub — multiplayer is experimental and not yet implemented. */

export const defaultIceServers: RTCIceServer[] = [];

export type PeerInfo = {
  id: string;
  name?: string;
};

export type P2PRoomOptions = {
  roomId: string;
  peerId: string;
};

export type SignalKind = "offer" | "answer" | "ice";

export type PeerRow = {
  id: string;
  name?: string;
};

export type SignalRow = {
  kind: SignalKind;
  from: string;
  payload: unknown;
};

export type RtcPollResponse = {
  peers: PeerRow[];
  signals: SignalRow[];
};

export class P2PRoom {
  constructor(_opts: P2PRoomOptions) {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  onPeer(_cb: (peer: PeerInfo) => void): void {}
  onSignal(_cb: (signal: SignalRow) => void): void {}
}
