export type AudioSourceKind = "tab" | "mic" | "silent";

export interface AudioCapture {
  kind: AudioSourceKind;
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  label: string;
  stop(): void;
}

function wire(ctx: AudioContext, stream: MediaStream): AnalyserNode {
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  // time-average the spectrum: at our ~25ms read cadence, raw instantaneous
  // FFTs of real music are noise — flux only means "onset" over a smoothed base
  analyser.smoothingTimeConstant = 0.5;
  src.connect(analyser);
  // deliberately NOT connected to destination: tab audio already plays in its own tab
  return analyser;
}

/**
 * Tab/system audio via screen-share picker. Chrome shows a "share tab audio"
 * checkbox; we immediately stop the video track since only audio matters.
 */
export async function captureTab(): Promise<AudioCapture> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("No audio track — tick “Also share tab audio” in the picker.");
  }
  stream.getVideoTracks().forEach((t) => t.stop());
  const ctx = new AudioContext();
  const analyser = wire(ctx, stream);
  return {
    kind: "tab",
    ctx,
    analyser,
    label: audioTracks[0].label || "Tab audio",
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export async function captureMic(): Promise<AudioCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const analyser = wire(ctx, stream);
  return {
    kind: "mic",
    ctx,
    analyser,
    label: stream.getAudioTracks()[0]?.label || "Microphone",
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

export function silentSource(): AudioCapture {
  return { kind: "silent", ctx: null, analyser: null, label: "No music (120 BPM clock)", stop: () => {} };
}
