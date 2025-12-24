interface PanelShellProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  dragBar: React.ReactNode;
  resizeHandles: React.ReactNode;
}

export function PanelShell({ panelRef, dragBar, children, resizeHandles }: PanelShellProps) {
  return (
    <div ref={panelRef} className="readerpanel-container">
      {dragBar}
      {children}
      {resizeHandles}
    </div>
  );
}
