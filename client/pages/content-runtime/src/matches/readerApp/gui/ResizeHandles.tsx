type ResizeDir = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface ResizeHandlesProps {
  startResize: (direction: ResizeDir) => (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function ResizeHandles({ startResize }: ResizeHandlesProps) {
  return (
    <>
      {/* Corners */}
      <div onMouseDown={startResize('nw')} className="handle handle-nw" />
      <div onMouseDown={startResize('ne')} className="handle handle-ne" />
      <div onMouseDown={startResize('sw')} className="handle handle-sw" />
      <div onMouseDown={startResize('se')} className="handle handle-se" />

      {/* Edges */}
      <div onMouseDown={startResize('n')} className="handle handle-n" />
      <div onMouseDown={startResize('s')} className="handle handle-s" />
      <div onMouseDown={startResize('e')} className="handle handle-e" />
      <div onMouseDown={startResize('w')} className="handle handle-w" />
    </>
  );
}
