import { useRef, useEffect } from 'react';
import { Tide, CurrentTide, parseTimeToMinutes, interpolateTideLevel } from '../utils/tideHelpers';

interface TideChartProps {
  tides: Tide[];
  currentTide: CurrentTide | null;
}

export function TideChart({ tides, currentTide }: TideChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !tides.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 24; i += 3) {
      const x = (i / 24) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.beginPath();

    const points = [];
    for (let hour = 0; hour < 24; hour += 0.5) {
      const minutes = hour * 60;
      const level = interpolateTideLevel(tides, minutes);
      const x = (hour / 24) * width;
      const y = height - (level / 200) * height;
      points.push({ x, y });
    }

    points.forEach((point, idx) => {
      if (idx === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    if (currentTide) {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const x = (currentHour / 24) * width;
      const y = height - (currentTide.level / 200) * height;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 24; i += 3) {
      const x = (i / 24) * width;
      ctx.fillText(`${i}:00`, x, height - 5);
    }

    tides.forEach(tide => {
      const tideMinutes = parseTimeToMinutes(tide.time);
      const x = (tideMinutes / (24 * 60)) * width;
      const y = height - (tide.level / 200) * height;

      ctx.fillStyle = tide.type === 'high' ? '#3b82f6' : '#f97316';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = tide.type === 'high' ? '#93c5fd' : '#fdba74';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tide.time, x, y - 10);
    });
  }, [tides, currentTide]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="w-full bg-slate-900 rounded"
    />
  );
}
