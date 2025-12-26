interface PanelShellProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  dragBar: React.ReactNode;
  resizeHandles: React.ReactNode;
}

export function PanelShell({ panelRef, dragBar, children, resizeHandles }: PanelShellProps) {
  return (
    <div
      ref={panelRef}
      className="fixed z-[999999] flex select-none flex-col rounded-xl bg-white shadow-2xl"
      style={{ left: 96, top: 96, width: 300, height: 400 }}>
      {dragBar}
      {children}
      {resizeHandles}
    </div>
  );
}

