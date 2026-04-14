import React, { useEffect, useState } from 'react';
import './CircularRing.css';

export default function CircularRing({ score, size = 120, strokeWidth = 8 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let t = 0;
    const end = score || 0;
    const duration = 1500;
    const interval = 20;
    const steps = duration / interval;
    const stepValue = end / steps;

    const timer = setInterval(() => {
      t += 1;
      if (t >= steps) {
        setAnimatedScore(end);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(t * stepValue));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedScore / 100) * circumference;

  const color = animatedScore >= 80 ? '#32D74B' : animatedScore >= 60 ? '#ffbd2e' : '#ff5f57';

  return (
    <div className="circular-ring-wrapper" style={{ width: size, height: size }}>
      <svg className="circular-ring-svg" width={size} height={size}>
        <circle
          className="circular-ring-bg"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="circular-ring-progress"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={color}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="circular-ring-content" style={{ color }}>
        <span className="cr-score">{animatedScore}</span>
        <span className="cr-max">/100</span>
      </div>
    </div>
  );
}
