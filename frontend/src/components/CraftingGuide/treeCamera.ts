export type TreeCamera = { x: number; y: number; zoom: number };
export function zoomAt(camera: TreeCamera, requestedZoom: number, anchorX: number, anchorY: number): TreeCamera {
  const zoom = Math.min(2.5, Math.max(.2, requestedZoom));
  const ratio = zoom / camera.zoom;
  return { zoom, x: anchorX - (anchorX - camera.x) * ratio, y: anchorY - (anchorY - camera.y) * ratio };
}
