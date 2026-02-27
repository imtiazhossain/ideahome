import { useEffect, useState } from "react";

export interface MediaCapabilities {
  canScreenRecord: boolean;
  canCameraRecord: boolean;
  canAudioRecord: boolean;
}

/**
 * Detect browser support for screen/camera/audio recording.
 * Screen uses getDisplayMedia; camera and audio both use getUserMedia.
 */
export function useMediaCapabilities(): MediaCapabilities {
  const [capabilities, setCapabilities] = useState<MediaCapabilities>({
    canScreenRecord: false,
    canCameraRecord: false,
    canAudioRecord: false,
  });

  useEffect(() => {
    const hasMediaRecorder = typeof MediaRecorder !== "undefined";
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const mediaDevices = nav?.mediaDevices;

    setCapabilities({
      canScreenRecord: !!mediaDevices?.getDisplayMedia && hasMediaRecorder,
      canCameraRecord: !!mediaDevices?.getUserMedia && hasMediaRecorder,
      canAudioRecord: !!mediaDevices?.getUserMedia && hasMediaRecorder,
    });
  }, []);

  return capabilities;
}
