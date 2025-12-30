import type React from 'react';

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
      className="fixed left-24 top-24 z-[999999] flex h-[400px] w-[300px] select-none flex-col rounded-xl bg-white shadow-2xl">
      {dragBar}
      {children}
      {resizeHandles}
    </div>
  );
}
