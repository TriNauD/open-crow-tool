interface Props {
  x: number;
  y: number;
  onClick: () => void;
}

export default function FloatingButton({ x, y, onClick }: Props) {
  const clampedX = Math.max(70, Math.min(x, window.innerWidth - 70));
  const top = Math.max(8, y - 6);

  return (
    <button
      className="wtf-btn"
      style={{ left: clampedX, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      这他妈是啥？
    </button>
  );
}
