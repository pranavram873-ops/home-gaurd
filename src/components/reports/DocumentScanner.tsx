'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CV } from '@techstark/opencv-js';
import { Icon } from '@/components/ui/Icon';

type Point = { x: number; y: number };
type Quad = [Point, Point, Point, Point];
type ImageSize = { width: number; height: number };
type CropHandle = { label: string; point: Point; cornerIndex?: number; edge?: [number, number] };

interface DocumentScannerProps {
  onClose: () => void;
  onConfirm: (file: File) => void;
  onUseGallery: () => void;
  initialFile?: File;
  onRetake?: () => void;
}

function orderCorners(points: Point[]): Quad | null {
  if (points.length !== 4) return null;
  const topLeft = points.reduce((best, point) => point.x + point.y < best.x + best.y ? point : best);
  const bottomRight = points.reduce((best, point) => point.x + point.y > best.x + best.y ? point : best);
  const topRight = points.reduce((best, point) => point.x - point.y > best.x - best.y ? point : best);
  const bottomLeft = points.reduce((best, point) => point.x - point.y < best.x - best.y ? point : best);
  if (new Set([topLeft, topRight, bottomRight, bottomLeft]).size !== 4) return null;
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function defaultCorners(size: ImageSize): Quad {
  const x = size.width * 0.04;
  const y = size.height * 0.04;
  return [
    { x, y },
    { x: size.width - x, y },
    { x: size.width - x, y: size.height - y },
    { x, y: size.height - y },
  ];
}

function isValidQuad(points: Quad, size: ImageSize) {
  let direction = 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const afterNext = points[(index + 2) % points.length];
    area += current.x * next.y - next.x * current.y;
    const cross = (next.x - current.x) * (afterNext.y - next.y)
      - (next.y - current.y) * (afterNext.x - next.x);
    if (Math.abs(cross) < 1) return false;
    if (direction === 0) direction = Math.sign(cross);
    else if (Math.sign(cross) !== direction) return false;
  }
  return Math.abs(area) > size.width * size.height * 0.05;
}

function detectDocument(cv: CV, canvas: HTMLCanvasElement): Quad | null {
  const source = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let best: Quad | null = null;
  let largestArea = canvas.width * canvas.height * 0.08;

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 55, 165);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const approx = new cv.Mat();
      try {
        const area = cv.contourArea(contour);
        if (area <= largestArea || area > canvas.width * canvas.height * 0.97) continue;
        cv.approxPolyDP(contour, approx, cv.arcLength(contour, true) * 0.02, true);
        if (approx.rows !== 4) continue;
        const data = Array.from(approx.data32S);
        const quad = orderCorners([
          { x: data[0], y: data[1] },
          { x: data[2], y: data[3] },
          { x: data[4], y: data[5] },
          { x: data[6], y: data[7] },
        ]);
        if (quad && isValidQuad(quad, { width: canvas.width, height: canvas.height })) {
          best = quad;
          largestArea = area;
        }
      } finally {
        contour.delete();
        approx.delete();
      }
    }
  } finally {
    source.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }

  return best;
}

function cameraMessage(error: unknown) {
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera access was denied. Allow camera access for this site in your browser settings, then reopen the scanner.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Choose a memo image from your gallery instead.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot open the camera. Use a secure browser connection or choose a memo image from your gallery.';
  }
  return 'The camera could not be started. Check browser camera permissions and try again, or choose an image from your gallery.';
}

export function DocumentScanner({ onClose, onConfirm, onUseGallery, initialFile, onRetake }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const loadedInitialFile = useRef<File | null>(null);
  const draggingHandle = useRef<{ index: number; clientX: number; clientY: number; corners: Quad } | null>(null);
  const [cameraRequested, setCameraRequested] = useState(!initialFile);
  const [cv, setCv] = useState<CV | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [scannerError, setScannerError] = useState('');
  const [loadingCv, setLoadingCv] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [detectedCorners, setDetectedCorners] = useState<Quad | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [corners, setCorners] = useState<Quad | null>(null);
  const [processing, setProcessing] = useState(false);
  const [captureDetected, setCaptureDetected] = useState(false);
  const [loadingInitialImage, setLoadingInitialImage] = useState(Boolean(initialFile));

  useEffect(() => {
    if (!initialFile || loadedInitialFile.current === initialFile) return;
    loadedInitialFile.current = initialFile;
    let active = true;
    const reader = new FileReader();
    reader.onerror = () => {
      if (!active) return;
      setScannerError('The camera photo could not be opened. Take it again or choose a different image.');
      setLoadingInitialImage(false);
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const image = new Image();
      image.onerror = () => {
        if (!active) return;
        setScannerError('The camera photo could not be opened. Take it again or choose a different image.');
        setLoadingInitialImage(false);
      };
      image.onload = () => {
        if (!active) return;
        const scale = Math.min(1, 2400 / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          setScannerError('The camera photo could not be prepared for cropping. Take it again.');
          setLoadingInitialImage(false);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const size = { width: canvas.width, height: canvas.height };
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.94));
        setImageSize(size);
        setCorners(defaultCorners(size));
        setCaptureDetected(false);
        setLoadingInitialImage(false);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(initialFile);
    return () => {
      active = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [initialFile]);

  useEffect(() => {
    let active = true;
    import('@techstark/opencv-js')
      .then(async (packageModule) => packageModule.default ? packageModule.default : packageModule)
      .then((runtime) => {
        if (!runtime.Mat) throw new Error('OpenCV runtime is not ready.');
        if (active) setCv(runtime);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Could not load the document scanner:', error);
        setScannerError('The document scanner could not be loaded. Choose a memo image from your gallery instead.');
      })
      .finally(() => {
        if (active) setLoadingCv(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    if (!cameraRequested) {
      setCameraReady(false);
      return;
    }

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) throw new Error('The camera preview could not be opened.');
        video.srcObject = stream;
        await video.play();
        if (active) setCameraReady(true);
      } catch (error) {
        if (active) {
          setCameraRequested(false);
          setCameraError(cameraMessage(error));
        }
      }
    }

    void startCamera();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraRequested]);

  useEffect(() => {
    if (!cv || !cameraReady) return;
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    let active = true;
    let frameId = 0;
    let lastDetection = 0;
    const detectFrame = (time: number) => {
      if (!active) return;
      frameId = requestAnimationFrame(detectFrame);
      if (time - lastDetection < 500 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      lastDetection = time;
      try {
        const scale = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not prepare the camera image for edge detection.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const detected = detectDocument(cv, canvas);
        setDetectedCorners(detected?.map((point) => ({
          x: point.x / scale,
          y: point.y / scale,
        })) as Quad | null);
      } catch (error) {
        console.error('Document edge detection failed:', error);
        setScannerError('Automatic edge detection is unavailable. You can still capture and adjust the corners manually.');
      }
    };
    frameId = requestAnimationFrame(detectFrame);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [cv, cameraReady]);

  async function captureMemo() {
    const video = videoRef.current;
    if (!cv || !video || !cameraReady || !video.videoWidth || !video.videoHeight) return;
    setProcessing(true);
    setScannerError('');
    try {
      const scale = Math.min(1, 2000 / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not capture the camera image.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const found = detectDocument(cv, canvas);
      const size = { width: canvas.width, height: canvas.height };
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.94));
      setImageSize(size);
      setCorners(found ?? defaultCorners(size));
      setCaptureDetected(Boolean(found));
      setDetectedCorners(null);
      setCameraRequested(false);
      setCameraReady(false);
    } catch (error) {
      console.error('Could not capture the memo:', error);
      setScannerError('The memo could not be captured. Try again with more light and keep the full page in view.');
    } finally {
      setProcessing(false);
    }
  }

  function moveHandle(index: number, clientX: number, clientY: number) {
    const bounds = previewRef.current?.getBoundingClientRect();
    const drag = draggingHandle.current;
    if (!bounds || !imageSize || !drag || drag.index !== index) return;
    const deltaX = (clientX - drag.clientX) / bounds.width * imageSize.width;
    const deltaY = (clientY - drag.clientY) / bounds.height * imageSize.height;
    const next = drag.corners.map((point) => ({ ...point })) as Quad;
    if (index < 4) {
      const point = drag.corners[index];
      next[index] = {
        x: Math.max(0, Math.min(imageSize.width, point.x + deltaX)),
        y: Math.max(0, Math.min(imageSize.height, point.y + deltaY)),
      };
    } else {
      const edges: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0]];
      const [first, second] = edges[index - 4];
      const firstPoint = drag.corners[first];
      const secondPoint = drag.corners[second];
      const minX = Math.max(-firstPoint.x, -secondPoint.x);
      const maxX = Math.min(imageSize.width - firstPoint.x, imageSize.width - secondPoint.x);
      const minY = Math.max(-firstPoint.y, -secondPoint.y);
      const maxY = Math.min(imageSize.height - firstPoint.y, imageSize.height - secondPoint.y);
      const safeX = Math.max(minX, Math.min(maxX, deltaX));
      const safeY = Math.max(minY, Math.min(maxY, deltaY));
      next[first] = { x: firstPoint.x + safeX, y: firstPoint.y + safeY };
      next[second] = { x: secondPoint.x + safeX, y: secondPoint.y + safeY };
    }
    setCorners(next);
  }

  function handleCropKey(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!imageSize || !corners) return;
    const step = event.shiftKey ? 20 : 5;
    const offsets: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = corners.map((point) => ({ ...point })) as Quad;
    if (index < 4) {
      next[index] = {
        x: Math.max(0, Math.min(imageSize.width, next[index].x + offset.x)),
        y: Math.max(0, Math.min(imageSize.height, next[index].y + offset.y)),
      };
    } else {
      const edges: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 0]];
      const [first, second] = edges[index - 4];
      const safeX = Math.max(Math.max(-next[first].x, -next[second].x), Math.min(Math.min(imageSize.width - next[first].x, imageSize.width - next[second].x), offset.x));
      const safeY = Math.max(Math.max(-next[first].y, -next[second].y), Math.min(Math.min(imageSize.height - next[first].y, imageSize.height - next[second].y), offset.y));
      next[first] = { x: next[first].x + safeX, y: next[first].y + safeY };
      next[second] = { x: next[second].x + safeX, y: next[second].y + safeY };
    }
    setCorners(next);
  }

  async function rotateCapture() {
    if (!capturedImage || !imageSize || !corners) return;
    setProcessing(true);
    setScannerError('');
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not rotate the captured image.'));
        image.src = capturedImage;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.height;
      canvas.height = image.width;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not rotate the captured image.');
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(image, 0, 0);
      const rotatedCorners = corners.map((point) => ({
        x: image.height - point.y,
        y: point.x,
      }));
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.94));
      setImageSize({ width: canvas.width, height: canvas.height });
      setCorners(orderCorners(rotatedCorners) ?? defaultCorners({ width: canvas.width, height: canvas.height }));
    } catch (error) {
      console.error('Could not rotate the memo image:', error);
      setScannerError('The image could not be rotated. Retake the photo and try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function confirmScan() {
    if (!cv || !capturedImage || !imageSize || !corners || !isValidQuad(corners, imageSize)) return;
    setProcessing(true);
    setScannerError('');
    const resources: Array<{ delete: () => void }> = [];
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not read the captured image.'));
        image.src = capturedImage;
      });
      const source = cv.imread(image);
      resources.push(source);
      const [topLeft, topRight, bottomRight, bottomLeft] = corners;
      const outputWidth = Math.min(2400, Math.round(Math.max(
        Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
        Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y),
      )));
      const outputHeight = Math.min(2400, Math.round(Math.max(
        Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
        Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y),
      )));
      if (outputWidth < 80 || outputHeight < 80) throw new Error('The crop is too small. Move the corners around the full memo.');
      const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        topLeft.x, topLeft.y, topRight.x, topRight.y,
        bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y,
      ]);
      const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, outputWidth - 1, 0,
        outputWidth - 1, outputHeight - 1, 0, outputHeight - 1,
      ]);
      const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
      const warped = new cv.Mat();
      const enhanced = new cv.Mat();
      const softened = new cv.Mat();
      const polished = new cv.Mat();
      resources.push(sourcePoints, destinationPoints, transform, warped, enhanced, softened, polished);
      cv.warpPerspective(
        source,
        warped,
        transform,
        new cv.Size(outputWidth, outputHeight),
        cv.INTER_CUBIC,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255),
      );
      // Lift the paper tones and sharpen text while preserving colored stamps,
      // handwriting, and the natural look of the original page.
      cv.convertScaleAbs(warped, enhanced, 1.08, 6);
      cv.GaussianBlur(enhanced, softened, new cv.Size(0, 0), 0.7);
      cv.addWeighted(enhanced, 1.18, softened, -0.18, 0, polished);
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      cv.imshow(outputCanvas, polished);
      const blob = await new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('Could not create the scanned memo image.'));
        }, 'image/jpeg', 0.97);
      });
      onConfirm(new File([blob], 'home-guard-memo-scan.jpg', { type: 'image/jpeg' }));
    } catch (error) {
      console.error('Could not process the memo scan:', error);
      setScannerError(error instanceof Error ? error.message : 'The memo could not be scanned. Adjust the corners or retake the photo.');
    } finally {
      resources.forEach((resource) => resource.delete());
      setProcessing(false);
    }
  }

  if (typeof document === 'undefined') return null;
  const detectedPoints = detectedCorners?.map((point) => `${point.x},${point.y}`).join(' ');
  const reviewPoints = corners?.map((point) => `${point.x},${point.y}`).join(' ');
  const cropHandles: CropHandle[] = corners ? [
    { label: 'Top left corner', point: corners[0], cornerIndex: 0 },
    { label: 'Top right corner', point: corners[1], cornerIndex: 1 },
    { label: 'Bottom right corner', point: corners[2], cornerIndex: 2 },
    { label: 'Bottom left corner', point: corners[3], cornerIndex: 3 },
    { label: 'Top edge midpoint', point: { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }, edge: [0, 1] },
    { label: 'Right edge midpoint', point: { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 }, edge: [1, 2] },
    { label: 'Bottom edge midpoint', point: { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 }, edge: [2, 3] },
    { label: 'Left edge midpoint', point: { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }, edge: [3, 0] },
  ] : [];
  const cornersValid = Boolean(imageSize && corners && isValidQuad(corners, imageSize));

  return createPortal(
    <div className="overlay-enter fixed inset-0 z-[130] flex items-center justify-center bg-surface-container/70 p-2 backdrop-blur-xs sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-scanner-title"
        className="overlay-panel flex h-[min(96dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between bg-primary px-4 py-3 text-on-primary">
          <div className="flex min-w-0 items-center gap-2">
            <Icon icon="document_scanner" size={20} />
            <div className="min-w-0">
              <h2 id="document-scanner-title" className="truncate text-sm font-bold">Scan memo</h2>
              <p className="text-[11px] text-on-primary/80">{capturedImage ? 'Review and adjust the scan' : 'Align the full memo inside the frame'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close document scanner" className="rounded-md p-2 hover:bg-white/10">
            <Icon icon="close" size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {!capturedImage ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              {initialFile ? (
                <div className="max-w-md rounded-xl border border-outline-variant bg-surface-container-low p-5 text-center">
                  {loadingInitialImage ? <Icon icon="sync" size={28} className="mx-auto animate-spin text-primary" /> : <Icon icon="error" size={28} className="mx-auto text-error" />}
                  <p role={scannerError ? 'alert' : undefined} className="mt-2 text-sm font-semibold text-on-surface">{scannerError || 'Preparing your camera photo for cropping…'}</p>
                  {!loadingInitialImage && <button type="button" onClick={onRetake ?? onUseGallery} className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary">Take photo again</button>}
                </div>
              ) : cameraError ? (
                <div className="max-w-md rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center">
                  <Icon icon="no_photography" size={28} className="mx-auto text-primary" />
                  <p role="alert" className="mt-2 text-sm font-semibold text-on-surface">{cameraError}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setCameraError(''); setCameraRequested(true); }}
                      className="min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                    >
                      Try camera again
                    </button>
                    <button type="button" onClick={onUseGallery} className="min-h-10 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface">
                    Choose from gallery
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-black" style={{ aspectRatio: `${videoRef.current?.videoWidth || 4}/${videoRef.current?.videoHeight || 3}` }}>
                    <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" aria-label="Live camera preview of the memo" />
                    {cameraReady ? (
                      <svg
                        viewBox={`0 0 ${videoRef.current?.videoWidth || 4} ${videoRef.current?.videoHeight || 3}`}
                        preserveAspectRatio="xMidYMid meet"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        aria-hidden="true"
                      >
                        {detectedPoints ? (
                          <polygon points={detectedPoints} fill="rgba(34,197,94,.12)" stroke="#4ade80" strokeWidth="8" vectorEffect="non-scaling-stroke" />
                        ) : (
                          <rect x="4%" y="4%" width="92%" height="92%" rx="12" fill="none" stroke="#f8fafc" strokeDasharray="14 12" strokeWidth="6" vectorEffect="non-scaling-stroke" />
                        )}
                      </svg>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                        <Icon icon="sync" size={26} className="animate-spin text-primary" />
                        <p className="text-sm font-semibold">{loadingCv ? 'Loading scanner and camera…' : 'Starting camera…'}</p>
                      </div>
                    )}
                  </div>
                  <p aria-live="polite" className="text-center text-xs text-on-surface-variant">
                    {loadingCv ? 'Preparing on-device document detection…' : detectedCorners ? 'Memo edges detected — keep the outline around the page.' : 'Move closer, keep the memo flat, and avoid shadows.'}
                  </p>
                  {scannerError && <p role="alert" className="max-w-lg text-center text-xs font-semibold text-on-error-container">{scannerError}</p>}
                </>
              )}
            </div>
          ) : imageSize && corners ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <p className="text-center text-xs text-on-surface-variant">
                {captureDetected ? 'Check the detected edges. Drag any corner or edge point, or use arrow keys to adjust.' : 'Does this photo look okay? Drag the corner and edge points to frame the memo, then save it as a PDF.'}
              </p>
              <div
                ref={previewRef}
                className="relative mx-auto w-full touch-none select-none"
                style={{ aspectRatio: `${imageSize.width}/${imageSize.height}` }}
              >
                <img src={capturedImage} alt="Captured memo with adjustable crop outline" className="absolute inset-0 h-full w-full rounded-lg object-fill" />
                <svg viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <polygon points={reviewPoints ?? ''} fill="rgba(34,197,94,.14)" stroke="#16a34a" strokeWidth={Math.max(2, imageSize.width / 300)} />
                </svg>
                {cropHandles.map(({ label, point }, index) => (
                  <button
                    key={index}
                    type="button"
                    role="slider"
                    aria-label={`${label} crop handle`}
                    aria-valuemin={0}
                    aria-valuemax={imageSize.width}
                    aria-valuenow={Math.round(point.x)}
                    aria-valuetext={`${Math.round(point.x)}, ${Math.round(point.y)}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      draggingHandle.current = { index, clientX: event.clientX, clientY: event.clientY, corners: corners! };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onKeyDown={(event) => handleCropKey(index, event)}
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border-[3px] shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${index < 4 ? 'h-11 w-11 border-white bg-primary' : 'h-8 w-8 border-primary bg-white'}`}
                    style={{ left: `${point.x / imageSize.width * 100}%`, top: `${point.y / imageSize.height * 100}%` }}
                    onPointerMove={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) moveHandle(index, event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                      draggingHandle.current = null;
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={(event) => {
                      draggingHandle.current = null;
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                  />
                ))}
              </div>
              {!cornersValid && <p role="alert" className="text-center text-xs font-semibold text-on-error-container">Keep the four corners in order and include the full memo.</p>}
              {scannerError && <p role="alert" className="text-center text-xs font-semibold text-on-error-container">{scannerError}</p>}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-surface-container-lowest p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!capturedImage ? (
            <>
              <button type="button" onClick={initialFile ? (onRetake ?? onUseGallery) : onUseGallery} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
                {initialFile ? 'Retake photo' : 'Use gallery instead'}
              </button>
              {initialFile ? (
                <span className="inline-flex min-h-11 items-center gap-2 px-2 text-xs font-semibold text-on-surface-variant">
                  {loadingInitialImage || loadingCv ? <Icon icon="sync" size={18} className="animate-spin" /> : null}
                  {loadingInitialImage ? 'Loading photo…' : loadingCv ? 'Preparing crop…' : 'Photo ready to adjust'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void captureMemo()}
                  disabled={!cameraReady || loadingCv || Boolean(cameraError) || Boolean(scannerError && !cv) || processing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing || loadingCv ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="photo_camera" size={18} />}
                  {processing ? 'Processing…' : loadingCv ? 'Loading scanner…' : 'Capture memo'}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (initialFile && onRetake) {
                      onRetake();
                      return;
                    }
                    setCapturedImage(null);
                    setImageSize(null);
                    setCorners(null);
                    setScannerError('');
                    setCameraError('');
                    setCameraRequested(true);
                  }}
                  disabled={processing}
                  className="min-h-10 rounded-lg px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                >
                  Retake photo
                </button>
                <button type="button" onClick={() => void rotateCapture()} disabled={processing} aria-label="Rotate memo clockwise" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
                  <Icon icon="rotate_right" size={16} />
                  Rotate
                </button>
              </div>
              <button
                type="button"
                onClick={() => void confirmScan()}
                disabled={!cv || loadingCv || !cornersValid || processing}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="check" size={18} />}
                {processing ? 'Creating PDF…' : 'Save as PDF'}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
